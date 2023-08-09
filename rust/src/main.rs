mod app_config;
mod components;
mod connection_peer;
mod http_server;
mod tls;
mod websocket_client;
mod websocket_server;
use app_config::AppConfig;
use components::{ResponseType, ResponseUnit};
use connection_peer::WebSocketPeer;
use futures::lock::Mutex;
use http_body_util::StreamBody;
use http_server::on_http;
use hyper::header::{
    HeaderValue, CONNECTION, SEC_WEBSOCKET_ACCEPT, SEC_WEBSOCKET_KEY, SEC_WEBSOCKET_VERSION,
    UPGRADE,
};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode, Version};
use std::collections::HashMap;
use std::convert::Infallible;
use std::io::ErrorKind;
use std::net::SocketAddr;
use std::sync::Arc;
use tls::{load_certs, load_keys};
use tokio_rustls::rustls::ServerConfig;
use tokio_rustls::TlsAcceptor;
use tokio_tungstenite::{tungstenite, WebSocketStream};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
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
        websocket_client::handle_request(&app_config, token, client).await?;
        return Ok(());
    }

    let certs = load_certs()?;
    let mut keys = load_keys()?;

    let config = ServerConfig::builder()
        .with_safe_defaults()
        .with_no_client_auth()
        .with_single_cert(certs, keys.pop().unwrap())
        .map_err(|err| std::io::Error::new(ErrorKind::InvalidInput, err))?;
    let acceptor = TlsAcceptor::from(Arc::new(config));

    // Create the event loop and TCP listener we'll accept connections on.
    let listener = tokio::net::TcpListener::bind(&app_config.listen_address.addr).await?;
    println!("{}", app_config);

    let peer_map = Arc::new(Mutex::new(HashMap::<String, WebSocketPeer>::new()));
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                let acceptor = acceptor.clone();
                let app_config = app_config.clone();
                let peer_map = peer_map.clone();
                tokio::spawn(async move {
                    let stream = acceptor.accept(stream).await?;
                    let service = |req: Request<hyper::body::Incoming>| {
                        http_websocket_classify(&app_config, &peer_map, addr, req)
                    };
                    if let Err(e) = http1::Builder::new()
                        .serve_connection(stream, service_fn(service))
                        .with_upgrades()
                        .await
                    {
                        app_config
                            .logger
                            .err(format!("Error serving connection: {:?}", e));
                    }
                    Ok::<(), std::io::Error>(())
                });
            }
            Err(e) => app_config.logger.err(format!(
                "Failed to build connection for incoming connection: {:?}",
                e
            )),
        }
    }
}

async fn http_websocket_classify(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    addr: SocketAddr,
    mut req: Request<hyper::body::Incoming>,
) -> Result<ResponseType, Infallible> {
    const UPGRADE_HEADER_VALUE: HeaderValue = HeaderValue::from_static("Upgrade");
    const WEBSOCKET_HEADER_VALUE: HeaderValue = HeaderValue::from_static("websocket");
    let headers = req.headers();
    let key = headers.get(SEC_WEBSOCKET_KEY);
    if let Some(key) = key {
        if req.method() == Method::GET
            && req.version() >= Version::HTTP_11
            && headers
                .get(CONNECTION)
                .and_then(|h| h.to_str().ok())
                .map(|h| {
                    h.split(|c| c == ' ' || c == ',')
                        .any(|p| p.eq_ignore_ascii_case("Upgrade"))
                })
                .unwrap_or(false)
            && headers
                .get(UPGRADE)
                .and_then(|h| h.to_str().ok())
                .map(|h| h.eq_ignore_ascii_case("websocket"))
                .unwrap_or(false)
            && headers
                .get(SEC_WEBSOCKET_VERSION)
                .map(|h| h == "13")
                .unwrap_or(false)
        {
            let derived = tungstenite::handshake::derive_accept_key(key.as_bytes())
                .parse()
                .unwrap();
            let ver = req.version();
            let (tx, rx) = futures::channel::mpsc::channel(1);
            drop(tx);
            let mut res = Response::new(StreamBody::new(rx));
            *res.status_mut() = StatusCode::SWITCHING_PROTOCOLS;
            *res.version_mut() = ver;
            let headers = res.headers_mut();
            headers.append(CONNECTION, UPGRADE_HEADER_VALUE);
            headers.append(UPGRADE, WEBSOCKET_HEADER_VALUE);
            headers.append(SEC_WEBSOCKET_ACCEPT, derived);
            let app_config = app_config.clone();
            let peer_map = peer_map.clone();
            tokio::task::spawn(async move {
                match hyper::upgrade::on(&mut req).await {
                    Ok(upgraded) => {
                        let ws_stream = WebSocketStream::from_raw_socket(
                            upgraded,
                            tungstenite::protocol::Role::Server,
                            None,
                        )
                        .await;
                        if let Err(err) = websocket_server::handle_request(
                            &app_config,
                            &peer_map,
                            &addr,
                            req,
                            ws_stream,
                        )
                        .await
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
            });
            return Ok(res);
        }
    }
    return on_http(&app_config, peer_map, &addr, req).await;
}
