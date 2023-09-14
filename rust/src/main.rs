mod common;
mod http_server;
mod tls;
mod websocket_client;
mod websocket_server;
use common::app_config::AppConfig;
use common::{AppContext, ResponseType, ResponseUnit};
use futures::channel::mpsc;
use futures::lock::Mutex;
use http_body_util::StreamBody;
use http_server::on_http;
use hyper::header;
use hyper::header::HeaderValue;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode, Version};
use std::collections::HashMap;
use std::convert::Infallible;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tls::{load_certs, load_keys};
use tokio::net::TcpStream;
use tokio_rustls::rustls::ServerConfig;
use tokio_rustls::TlsAcceptor;
use tokio_tungstenite::{tungstenite, WebSocketStream};

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let app_config = Arc::new(AppConfig::new());
    if let Some(ref token) = app_config.client {
        // internal client mode
        use tls::CustomServerCertVerifier;
        use tokio_rustls::rustls::ClientConfig;
        use tokio_tungstenite::{connect_async_tls_with_config, Connector};
        let connector = Connector::Rustls(Arc::new(
            ClientConfig::builder()
                .with_safe_defaults()
                .with_custom_certificate_verifier(Arc::new(CustomServerCertVerifier {}))
                .with_no_client_auth(),
        ));

        let master_server = format!("wss://{}/client?t={}", app_config.listen_address, token);
        app_config.logger.info(format!(
            "Running client mode (warning: this mode not for public usage) and connect to {}",
            master_server
        ));
        let (client, _) =
            connect_async_tls_with_config(master_server, None, false, Some(connector)).await?;
        let _ = websocket_client::handle_request(&app_config, token, client).await;
        std::process::exit(0);
        // return Ok(());
    }

    let certs = load_certs()?;
    let mut keys = load_keys()?;

    let config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(certs, keys.pop().unwrap())?;
    let acceptor = TlsAcceptor::from(Arc::new(config));

    // Create the event loop and TCP listener we'll accept connections on.
    let listener = tokio::net::TcpListener::bind(&app_config.listen_address.addr).await?;
    println!("{}", app_config);
    println!(
        "Please visit: https://localhost:{}\n",
        app_config.listen_address.port
    );

    let websocket_peers = Arc::new(Mutex::new(HashMap::new()));
    let authenticate_queues = Arc::new(Mutex::new(HashMap::new()));
    let suspended_clients = Arc::new(Mutex::new(HashMap::new()));
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                let context = AppContext {
                    app_config: app_config.clone(),
                    websocket_peers: websocket_peers.clone(),
                    authenticate_queues: authenticate_queues.clone(),
                    suspended_clients: suspended_clients.clone(),
                };
                tokio::spawn(handle_connection(context, stream, addr, acceptor.clone()));
            }
            Err(e) => app_config.logger.err(format!(
                "Failed to build connection for incoming connection: {:?}",
                e
            )),
        }
    }
}

async fn handle_connection(
    context: AppContext,
    stream: TcpStream,
    addr: SocketAddr,
    acceptor: TlsAcceptor,
) -> Result<(), std::io::Error> {
    let stream = acceptor.accept(stream).await?;
    let service =
        |req: Request<hyper::body::Incoming>| http_websocket_classify(&context, &addr, req);
    if let Err(e) = http1::Builder::new()
        .serve_connection(stream, service_fn(service))
        .with_upgrades()
        .await
    {
        context
            .app_config
            .logger
            .err(format!("Error serving connection: {:?}", e));
    }
    Ok(())
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
        let derived = tungstenite::handshake::derive_accept_key(key.as_bytes()).parse();
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
                    let (mut tx, rx) = mpsc::channel(1);
                    tx.close_channel();
                    let mut res = Response::new(StreamBody::new(rx));
                    *res.status_mut() = StatusCode::SWITCHING_PROTOCOLS;
                    *res.version_mut() = ver;
                    let headers = res.headers_mut();
                    headers.append(header::CONNECTION, UPGRADE_HEADER_VALUE);
                    headers.append(header::UPGRADE, WEBSOCKET_HEADER_VALUE);
                    headers.append(header::SEC_WEBSOCKET_ACCEPT, derived);
                    let context = context.clone();
                    let addr = addr.clone();
                    tokio::spawn(upgrade_web_socket(context, addr, req));
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

async fn upgrade_web_socket(
    context: AppContext,
    addr: SocketAddr,
    mut req: Request<hyper::body::Incoming>,
) {
    let app_config = context.app_config.clone();
    match hyper::upgrade::on(&mut req).await {
        Ok(upgraded) => {
            let ws_stream = WebSocketStream::from_raw_socket(
                upgraded,
                tungstenite::protocol::Role::Server,
                None,
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
