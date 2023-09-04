use crate::common::{app_config::AppConfig, connection_peer::WebSocketPeer, ResponseType};
use futures::lock::Mutex;
use hyper::{Method, Request};
use std::{collections::HashMap, convert::Infallible, net::SocketAddr, path::PathBuf, sync::Arc};

mod components;

mod not_found;
use not_found::not_found;

mod file_send;
use file_send::file_send;

mod client;
use client::on_client;

mod download;
use download::on_download;

mod upload;
use upload::on_upload;

mod preview;
use preview::on_preview;

pub async fn on_http(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    addr: SocketAddr,
    req: Request<hyper::body::Incoming>,
) -> Result<ResponseType, Infallible> {
    app_config.logger.info(format!(
        "New http ({}) connection: {}",
        req.uri().path(),
        addr
    ));
    use url::form_urlencoded::parse;
    if let Some(query) = req.uri().query() {
        let mut peers = parse(query.as_bytes()).into_owned();
        if let Some((_, token)) = peers.find(|(key, _)| key.as_str() == "t") {
            let peer_map = peer_map.lock().await;
            let peer = peer_map.get(&token);
            match peer {
                Some(peer) => {
                    let queue = peer.client_response_queue.clone();
                    let conn = peer.client_connection.clone();
                    drop(peer_map);
                    let mut upload_dir = vec![];
                    let mut upload_filename = None;
                    let mut preview = None;
                    let mut files = vec![];
                    for (key, value) in peers.into_iter() {
                        match key.as_str() {
                            "p" => {
                                files.push(value);
                            }
                            "u" => {
                                upload_dir.push(value);
                            }
                            "n" => {
                                upload_filename = Some(value);
                            }
                            "v" => {
                                preview = Some(value);
                            }
                            _ => {}
                        }
                    }
                    if files.len() != 0 {
                        return on_download(app_config, req, queue, conn, files).await;
                    } else if upload_dir.len() != 0 {
                        let dir: PathBuf = upload_dir.iter().collect();
                        if let Some(dir) = dir.as_os_str().to_str() {
                            return on_upload(app_config, req, queue, conn, dir, upload_filename)
                                .await;
                        }
                    } else if let Some(preview) = preview {
                        return on_preview(app_config, req, queue, conn, preview).await;
                    }
                    return Ok(not_found(app_config, "Unknown request").await);
                }
                None => {
                    return Ok(not_found(app_config, "Auth request failed").await);
                }
            }
        }
    }

    match (req.method(), req.uri().path()) {
        (_, "/client") => on_client(app_config, peer_map, req, addr).await,
        (&Method::GET | &Method::HEAD, "" | "/") => file_send(app_config, &req, "index.html").await,
        (&Method::GET | &Method::HEAD, path) => file_send(app_config, &req, &path[1..]).await,
        (m, path) => Ok(not_found(app_config, format!("Unknown request {:?} {:?}", m, path)).await),
    }
}
