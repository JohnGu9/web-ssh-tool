use super::components::BUF_SIZE;
use crate::{app_config::AppConfig, connection_peer::WebSocketPeer, ResponseType};
use futures::channel::mpsc::channel;
use futures::lock::Mutex;
use http_body_util::StreamBody;
use hyper::body::Incoming;
use hyper::{Request, Response};
use std::net::SocketAddr;
use std::{collections::HashMap, convert::Infallible, sync::Arc};

pub async fn on_client(
    _: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    mut req: Request<Incoming>,
    addr: SocketAddr,
) -> Result<ResponseType, Infallible> {
    let is_loopback = match addr {
        SocketAddr::V4(v4) => v4.ip().is_loopback(),
        SocketAddr::V6(v6) => v6.ip().is_loopback(),
    };
    let header = req.headers_mut();
    let (tx, rx) = channel(BUF_SIZE);
    if is_loopback {
        if let (Some(peer), Some(id)) = (header.remove("peer"), header.remove("id")) {
            if let (Ok(peer), Ok(id)) = (peer.to_str(), id.to_str()) {
                let peer_map = peer_map.lock().await;
                let peer = peer_map.get(peer);
                if let (Some(peer), Ok(id)) = (peer, id.parse::<u64>()) {
                    let client_response_queue = peer.client_response_queue.clone();
                    drop(peer_map);
                    client_response_queue.lock().await.feed(&id, (req, tx));
                }
            }
        }
    }
    let body = StreamBody::new(rx);
    let response = Response::new(body);
    return Ok(response);
}
