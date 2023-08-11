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
use std::error::Error;
use std::net::{IpAddr, SocketAddr};
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
        websocket_client::handle_request(&app_config, token, client).await?;
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
        "Please visit: https://127.0.0.1:{}",
        app_config.listen_address.port
    );

    app_config
        .logger
        .info(format!("App pid: {}", std::process::id()));
    let peer_map = Arc::new(Mutex::new(HashMap::new()));
    let wait_duration = Arc::new(Mutex::new(HashMap::new()));
    tokio::spawn(recycle_wait_duration(wait_duration.clone()));
    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                tokio::spawn(handle_connection(
                    stream,
                    addr,
                    acceptor.clone(),
                    app_config.clone(),
                    peer_map.clone(),
                    wait_duration.clone(),
                ));
            }
            Err(e) => app_config.logger.err(format!(
                "Failed to build connection for incoming connection: {:?}",
                e
            )),
        }
    }
}

async fn handle_connection(
    stream: TcpStream,
    addr: SocketAddr,
    acceptor: TlsAcceptor,
    app_config: Arc<AppConfig>,
    peer_map: Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    wait_duration: Arc<Mutex<HashMap<IpAddr, u64>>>,
) -> Result<(), std::io::Error> {
    let stream = acceptor.accept(stream).await?;
    let service = |req: Request<hyper::body::Incoming>| {
        http_websocket_classify(&app_config, &peer_map, &wait_duration, addr, req)
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
    Ok(())
}

async fn http_websocket_classify(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    wait_duration: &Arc<Mutex<HashMap<IpAddr, u64>>>,
    addr: SocketAddr,
    req: Request<hyper::body::Incoming>,
) -> Result<ResponseType, Infallible> {
    const UPGRADE_HEADER_VALUE: HeaderValue = HeaderValue::from_static("Upgrade");
    const WEBSOCKET_HEADER_VALUE: HeaderValue = HeaderValue::from_static("websocket");
    let headers = req.headers();
    let key = headers.get(SEC_WEBSOCKET_KEY);
    if let Some(key) = key {
        let derived = tungstenite::handshake::derive_accept_key(key.as_bytes()).parse();
        if let Ok(derived) = derived {
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
                let ver = req.version();
                let (mut tx, rx) = futures::channel::mpsc::channel(1);
                tx.close_channel();
                let mut res = Response::new(StreamBody::new(rx));
                *res.status_mut() = StatusCode::SWITCHING_PROTOCOLS;
                *res.version_mut() = ver;
                let headers = res.headers_mut();
                headers.append(CONNECTION, UPGRADE_HEADER_VALUE);
                headers.append(UPGRADE, WEBSOCKET_HEADER_VALUE);
                headers.append(SEC_WEBSOCKET_ACCEPT, derived);
                tokio::spawn(upgrade_web_socket(
                    app_config.to_owned(),
                    peer_map.to_owned(),
                    wait_duration.to_owned(),
                    addr,
                    req,
                ));
                return Ok(res);
            }
        }
    }
    return on_http(&app_config, peer_map, addr, req).await;
}

async fn upgrade_web_socket(
    app_config: Arc<AppConfig>,
    peer_map: Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    wait_duration: Arc<Mutex<HashMap<IpAddr, u64>>>,
    addr: SocketAddr,
    mut req: Request<hyper::body::Incoming>,
) {
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
                &wait_duration,
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
}

// reset the login limit protect in period time
async fn recycle_wait_duration(wait_duration: Arc<Mutex<HashMap<IpAddr, u64>>>) {
    use tokio::time::{sleep, Duration};
    let mut need_to_clean_up = vec![];
    loop {
        sleep(Duration::from_secs(60 * 5)).await;
        {
            let mut wait_duration = wait_duration.lock().await;
            for (ip, duration) in wait_duration.iter_mut() {
                *duration = *duration / 2;
                if *duration <= 2 {
                    need_to_clean_up.push(ip.clone());
                }
            }
            for ip in &need_to_clean_up {
                let _ = wait_duration.remove(&ip);
            }
            need_to_clean_up.clear();
        }
    }
}
