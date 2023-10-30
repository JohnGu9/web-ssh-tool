mod common;
mod http_server;
mod tls;
mod websocket_client;
mod websocket_server;
use common::app_config::AppConfig;
use common::{AppContext, ResponseType, ResponseUnit};
use futures::channel::mpsc;
use futures::lock::Mutex;
use futures::{Future, SinkExt, StreamExt};
use http_body_util::StreamBody;
use http_server::on_http;
use hyper::header;
use hyper::header::HeaderValue;
use hyper::rt::Executor;
use hyper::server::conn::{http1, http2};
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode, Version};
use std::collections::HashMap;
use std::convert::Infallible;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tls::{load_certs, load_keys};
use tokio_rustls::rustls::ServerConfig;
use tokio_rustls::TlsAcceptor;
use tokio_tungstenite::tungstenite::{
    handshake::derive_accept_key,
    protocol::{Role, WebSocketConfig},
};
use tokio_tungstenite::WebSocketStream;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let app_config = Arc::new(AppConfig::new());
    if let Some(ref token) = app_config.client {
        // @TODO: send log to master
        // internal client mode
        use tls::CustomServerCertVerifier;
        use tokio_rustls::rustls::ClientConfig;
        use tokio_tungstenite::{connect_async_tls_with_config, Connector};
        let connector = Connector::Rustls(Arc::new(
            ClientConfig::builder()
                .with_safe_defaults()
                .with_custom_certificate_verifier(Arc::new(CustomServerCertVerifier {})) // @TODO: verify server cert
                .with_no_client_auth(),
        ));

        let master_server = format!("wss://{}/client?t={}", app_config.listen_address, token);
        app_config.logger.info(format!(
            "Running client mode (warning: this mode not for public usage) and connect to {}",
            master_server
        ));
        if let Ok((client, _)) =
            connect_async_tls_with_config(master_server, None, false, Some(connector)).await
        {
            let _ = websocket_client::handle_request(&app_config, token, client).await;
        } else {
            app_config
                .logger
                .err(format!("Client mode failed to connect to master! "));
        }
        std::process::exit(0);
        // return Ok(());
    }

    let (listener, cert_source, key_source) = futures::join!(
        tokio::net::TcpListener::bind(&app_config.listen_address.addr),
        read_file(&app_config.certificate, "Failed to read certificate file"),
        read_file(&app_config.private_key, "Failed to read private key file"),
    );
    let listener = listener?;

    let certs = load_certs(&cert_source)?;
    let mut keys = load_keys(&key_source)?;
    let mut config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(certs, keys.pop().expect("SSL private key not found"))?;
    config.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec(), b"http/1.0".to_vec()];
    let acceptor = TlsAcceptor::from(Arc::new(config));

    // Create the event loop and TCP listener we'll accept connections on.
    println!("{}", app_config);
    println!(
        "Please visit: https://localhost:{}\n",
        app_config.listen_address.port
    );

    let (mut tx, rx) = mpsc::channel(0);
    tokio::spawn(async move {
        loop {
            let item = listener.accept().await;
            if let Err(_) = tx.send(item).await {
                break;
            }
        }
    });

    let websocket_peers = Arc::new(Mutex::new(HashMap::new()));
    let authenticate_queues = Arc::new(Mutex::new(HashMap::new()));
    let suspended_clients = Arc::new(Mutex::new(HashMap::new()));
    let context = AppContext {
        app_config: app_config.clone(),
        websocket_peers,
        authenticate_queues,
        suspended_clients,
    };
    let http1_service = http1::Builder::new();
    let http2_service = http2::Builder::new(TokioExecutor);

    // @TODO: concurrent limit can be set by arguments
    rx.for_each_concurrent(None, |item| async {
        match item {
            Ok((stream, addr)) => {
                match acceptor.accept(stream).await {
                    Ok(stream) => {
                        let (_, session) = stream.get_ref();
                        let is_h2 = match session.alpn_protocol() {
                            Some(alpn) => alpn == b"h2",
                            None => false,
                        };
                        let res = if is_h2 {
                            let handle = |req| {
                                let context = context.clone();
                                let addr = addr.clone();
                                async move { on_http(&context, &addr, req).await }
                            };
                            // Warning:
                            // ```let handle = move |req| on_http(&context, &addr, req);```
                            // doesn't work!
                            // Because the reference (for example &content) only catch by the sync function ```move |req| {/* */}```
                            // But the sync function return a future and this future will be scheduled by tokio async machine and the lifecycle detach from the sync function.
                            // So the future may or may not live longer than the sync function.
                            // The lifecycle-detach future still access the sync function data so that causes error.
                            http2_service
                                .serve_connection(stream, service_fn(handle))
                                .await
                        } else {
                            let handle = |req| http_websocket_classify(&context, &addr, req);
                            http1_service
                                .serve_connection(stream, service_fn(handle))
                                .with_upgrades()
                                .await
                        };
                        if let Err(e) = res {
                            app_config
                                .logger
                                .err(format!("Failed to serve connection: {:?}", e));
                        }
                    }
                    Err(e) => app_config
                        .logger
                        .err(format!("Failed to ssl handshake from {:?}: {:?}", addr, e)),
                }
            }
            Err(e) => app_config.logger.err(format!(
                "Failed to build connection for incoming connection: {:?}",
                e
            )),
        }
    })
    .await;

    Ok(())
}

async fn read_file(path: &Option<String>, expect: &str) -> Option<Vec<u8>> {
    match path {
        Some(path) => {
            let v = tokio::fs::read(path).await.expect(expect);
            Some(v)
        }
        None => None,
    }
}

#[derive(Clone)]
struct TokioExecutor;

impl<F> Executor<F> for TokioExecutor
where
    F: Future + Send + 'static,
    F::Output: Send + 'static,
{
    fn execute(&self, future: F) {
        tokio::spawn(future);
    }
}

async fn http_websocket_classify(
    context: &AppContext,
    addr: &SocketAddr,
    req: Request<hyper::body::Incoming>,
) -> Result<ResponseType, Infallible> {
    const UPGRADE_HEADER_VALUE: HeaderValue = HeaderValue::from_static("Upgrade");
    const WEBSOCKET_HEADER_VALUE: HeaderValue = HeaderValue::from_static("websocket");
    let headers = req.headers();
    let key = headers.get(header::SEC_WEBSOCKET_KEY);
    if let Some(key) = key {
        let derived = derive_accept_key(key.as_bytes()).parse();
        match derived {
            Ok(derived) => {
                if req.method() == Method::GET
                    && req.version() >= Version::HTTP_11
                    && headers
                        .get(header::CONNECTION)
                        .and_then(|h| h.to_str().ok())
                        .map(|h| {
                            h.split(|c| c == ' ' || c == ',')
                                .any(|p| p.eq_ignore_ascii_case("Upgrade"))
                        })
                        .unwrap_or(false)
                    && headers
                        .get(header::UPGRADE)
                        .and_then(|h| h.to_str().ok())
                        .map(|h| h.eq_ignore_ascii_case("websocket"))
                        .unwrap_or(false)
                    && headers
                        .get(header::SEC_WEBSOCKET_VERSION)
                        .map(|h| h == "13")
                        .unwrap_or(false)
                {
                    let ver = req.version();
                    let context = context.clone();
                    let addr = addr.clone();
                    tokio::spawn(upgrade_websocket(context, addr, req));

                    let (_, rx) = mpsc::channel(1);
                    let mut res = Response::new(StreamBody::new(rx));
                    *res.status_mut() = StatusCode::SWITCHING_PROTOCOLS;
                    *res.version_mut() = ver;
                    let headers = res.headers_mut();
                    headers.append(header::CONNECTION, UPGRADE_HEADER_VALUE);
                    headers.append(header::UPGRADE, WEBSOCKET_HEADER_VALUE);
                    headers.append(header::SEC_WEBSOCKET_ACCEPT, derived);
                    return Ok(res);
                } else {
                    context
                    .app_config.logger.err(format!(
                        "Connection ({}) come with SEC_WEBSOCKET_KEY but can't upgrade to websocket and fallback to normal http handle. ",&addr
                    ));
                }
            }
            Err(err) => {
                context
                    .app_config
                    .logger
                    .err(format!("Error derive_accept_key: {}. ", err));
            }
        }
    }
    return on_http(context, addr, req).await;
}

async fn upgrade_websocket(
    context: AppContext,
    addr: SocketAddr,
    mut req: Request<hyper::body::Incoming>,
) {
    let app_config = context.app_config.clone();
    match hyper::upgrade::on(&mut req).await {
        Ok(upgraded) => {
            let ws_stream = WebSocketStream::from_raw_socket(
                upgraded,
                Role::Server,
                Some(WebSocketConfig::default()),
            )
            .await;
            if let Err(err) = websocket_server::handle_request(context, &addr, req, ws_stream).await
            {
                app_config
                    .logger
                    .err(format!("From {:?} websocket error: {:?}", addr, err));
            }
        }
        Err(e) => app_config
            .logger
            .err(format!("Websocket upgrade error: {}", e)),
    }
}
