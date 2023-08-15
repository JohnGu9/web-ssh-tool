mod on_authenticate;
mod on_client;
mod on_request_authenticate;
mod shell;
use crate::{app_config::AppConfig, connection_peer::WebSocketPeer};
use futures::channel::{mpsc, oneshot};
use futures::lock::Mutex;
use hyper::{upgrade::Upgraded, Request};
use std::{collections::HashMap, error::Error, net::SocketAddr, sync::Arc};
use tokio_tungstenite::WebSocketStream;

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    authenticate_queues: &Arc<Mutex<HashMap<String, mpsc::Sender<oneshot::Receiver<()>>>>>,
    addr: &SocketAddr,
    req: Request<hyper::body::Incoming>,
    ws_stream: WebSocketStream<Upgraded>,
) -> Result<(), Box<dyn Error>> {
    match req.uri().path() {
        "/" | "/rest" | "/rest/" => {
            on_request_authenticate::handle_request(
                app_config,
                peer_map,
                authenticate_queues,
                addr,
                req,
                ws_stream,
            )
            .await
        }
        "/client" => {
            let is_loopback = match addr {
                SocketAddr::V4(v4) => v4.ip().is_loopback(),
                SocketAddr::V6(v6) => v6.ip().is_loopback(),
            };
            if let (Some(query), true) = (req.uri().query(), is_loopback) {
                use url::form_urlencoded::parse;
                let mut peers = parse(query.as_bytes()).into_owned();
                if let Some((_, token)) = peers.find(|(key, _)| key.as_str() == "t") {
                    on_client::handle_request(app_config, peer_map, ws_stream, token.as_str())
                        .await?;
                    return Ok(());
                }
            }
            app_config
                .logger
                .err(format!("Unknown client ws connection ({})", req.uri()));
            Ok(())
        }
        _ => {
            app_config
                .logger
                .err(format!("Unknown ws connection ({})", req.uri()));
            Ok(())
        }
    }
}
