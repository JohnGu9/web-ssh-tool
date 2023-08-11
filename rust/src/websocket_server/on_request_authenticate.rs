use super::on_authenticate;
use crate::app_config::AppConfig;
use crate::connection_peer::Client;
use crate::connection_peer::ClientConnection;
use crate::connection_peer::WebSocketPeer;
use futures::channel::mpsc::Receiver;
use futures::lock::Mutex;
use futures::{SinkExt, StreamExt};
use hyper::{upgrade::Upgraded, Request};
use serde_json::json;
use std::net::IpAddr;
use std::{collections::HashMap, error::Error, net::SocketAddr, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    wait_duration: &Arc<Mutex<HashMap<IpAddr, u64>>>,
    addr: &SocketAddr,
    _: Request<hyper::body::Incoming>,
    mut ws_stream: WebSocketStream<Upgraded>,
) -> Result<(), Box<dyn Error>> {
    app_config
        .logger
        .info(format!("New websocket connection({}) connected", addr));

    let config = russh::client::Config::default();
    let config = Arc::new(config);
    let sh = Client {};
    let mut session = russh::client::connect(
        config.clone(),
        format!("localhost:{}", app_config.local_ssh_port),
        sh,
    )
    .await?;

    let mut token_and_connection = None;

    while let Some(Ok(data)) = ws_stream.next().await {
        let text = match data {
            Message::Text(t) => t,
            Message::Binary(bytes) => {
                match String::from_utf8(bytes) {
                    Ok(t) => t,
                    Err(_) => continue,
                }
            }
            Message::Ping(bytes) => {
                ws_stream.send(Message::Pong(bytes)).await?;
                continue;
            }
            _ => continue,
        };

        let mut cause_cache = String::new();
        let result: Result<
            (
                String,
                Arc<Mutex<ClientConnection>>,
                Receiver<serde_json::Value>,
            ),
            &str,
        > = async {
            let (username, password) = match parse_username_and_password(text) {
                Some((username, password)) => (username, password),
                None => return Err("Sign in message format error"),
            };
            match session.authenticate_password(username, password).await {
                Ok(false) => {
                    let mut lock = wait_duration.lock().await;
                    let ip = addr.ip();
                    match lock.get_mut(&ip) {
                        Some(wait_duration) => {
                            if *wait_duration >= (u64::MAX / 2) {
                                *wait_duration = u64::MAX
                            } else {
                                *wait_duration += *wait_duration;
                            }
                        }
                        None => {
                            lock.insert(ip, 2);
                        }
                    }
                    return Err("Username and password authenticate failed");
                }
                Err(err) => {
                    // renew session
                    let sh = Client {};
                    if let Ok(s) = russh::client::connect(
                        config.clone(),
                        format!("localhost:{}", app_config.local_ssh_port),
                        sh,
                    )
                    .await
                    {
                        session = s;
                    }

                    cause_cache = format!("Internal error: {:?}", err);
                    return Err(cause_cache.as_str());
                }
                _ => {}
            };

            let mut channel = match session.channel_open_session().await {
                Ok(ch) => ch,
                Err(err) => {
                    cause_cache = format!("Local ssh establishing failed: {:?}", err);
                    return Err(cause_cache.as_str());
                }
            };

            let mut map = peer_map.lock().await;
            let token_uuid = uuid::Uuid::new_v4();
            let token = token_uuid.to_string();
            if let Some(_) = map.get(&token) {
                return Err("Internal error: id generation failed");
            }
            if let Some(_) = map.iter().find(|(_, value)| value.addr == *addr) {
                return Err("user already sign in");
            }

            let command = format!(
                "{} --client {} --listen-address 127.0.0.1:{}",
                app_config.bin, token, app_config.listen_address.port
            );
            let (tx, rx) = futures::channel::mpsc::channel(1);
            tokio::spawn(async move { channel.exec(true, command).await });
            let peer = WebSocketPeer::new(token.clone(), addr.clone(), tx);
            let client_connection = peer.client_connection.clone();
            map.insert(token.clone(), peer);
            return Ok((token, client_connection, rx));
        }
        .await;

        let wait = {
            let lock = wait_duration.lock().await;
            let ip = addr.ip();
            match lock.get(&ip) {
                Some(s) => Some(s.clone()),
                None => None,
            }
        };
        if let Some(wait) = wait {
            // Username and password authenticate failed
            // Login limit protection
            tokio::time::sleep(tokio::time::Duration::from_secs(wait)).await;
            tokio::task::yield_now().await;
        }

        match result {
            Err(cause) => {
                let message = format!("Authenticate failed ({})", cause);
                app_config.logger.err(format!("{} for {:?}", message, addr));
                let response = json!({"error": message});
                ws_stream.send(Message::text(response.to_string())).await?;
            }
            Ok((token, client_connection, rx)) => {
                token_and_connection = Some((token, client_connection, rx));
                break;
            }
        }
    }

    if let Some((token, client_connection, rx)) = token_and_connection {
        let response = json!({ "token": token });
        ws_stream.send(Message::text(response.to_string())).await?;
        on_authenticate::handle_request(&token, &client_connection, ws_stream, rx, session).await?;
        let mut map = peer_map.lock().await;
        if let Some(peer) = map.remove(&token) {
            peer.disconnect().await;
        }
    }

    app_config
        .logger
        .info(format!("The websocket connection({}) disconnected", addr));

    Ok(())
}

fn parse_username_and_password(text: String) -> Option<(String, String)> {
    use serde_json::Value::{Object, String};
    if let Ok(Object(mut obj)) = serde_json::from_str::<serde_json::Value>(text.as_str()) {
        let username = obj.remove("username");
        let password = obj.remove("password");
        if let (Some(String(username)), Some(String(password))) = (username, password) {
            return Some((username, password));
        }
    }
    return None;
}
