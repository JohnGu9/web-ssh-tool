use super::on_authenticate;
use crate::app_config::AppConfig;
use crate::connection_peer::Client;
use crate::connection_peer::ClientConnection;
use crate::connection_peer::WebSocketPeer;
use futures::lock::Mutex;
use futures::{SinkExt, StreamExt};
use hyper::{upgrade::Upgraded, Request};
use serde_json::json;
use std::{collections::HashMap, error::Error, net::SocketAddr, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
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

    while let Some(Ok(data)) = ws_stream.next().await {
        let text: String;
        match data {
            Message::Text(t) => {
                text = t;
            }
            Message::Binary(bytes) => {
                if let Ok(t) = String::from_utf8(bytes) {
                    text = t;
                } else {
                    continue;
                }
            }
            Message::Ping(bytes) => {
                ws_stream.send(Message::Pong(bytes)).await?;
                continue;
            }
            _ => continue,
        }

        let cause_cache: String;
        let cause: &str;
        if let Some((username, password)) = parse_username_and_password(text) {
            match session.authenticate_password(username, password).await {
                Ok(success) => {
                    if success {
                        let (tx, rx) = futures::channel::mpsc::channel(1);
                        let check_repeat_client: Result<
                            (String, Arc<Mutex<ClientConnection>>),
                            &str,
                        > = async {
                            let mut map = peer_map.lock().await;
                            if let None = map.iter().find(|(_, value)| value.addr == *addr) {
                                if let Ok(mut channel) = session.channel_open_session().await {
                                    let token_uuid = uuid::Uuid::new_v4();
                                    let token = token_uuid.to_string();

                                    let command = format!(
                                        "{} --client {} --listen-address 127.0.0.1:{}",
                                        app_config.bin, token, app_config.listen_address.port
                                    );
                                    tokio::spawn(async move { channel.exec(true, command).await });
                                    let peer = WebSocketPeer::new(token.clone(), addr.clone(), tx);
                                    let client_connection = peer.client_connection.clone();
                                    map.insert(token.clone(), peer);
                                    return Ok((token, client_connection));
                                }
                                return Err("can't establish local ssh");
                            }
                            return Err("user already sign in");
                        }
                        .await;
                        match check_repeat_client {
                            Ok((token, client_connection)) => {
                                let response = json!({ "token": token });
                                ws_stream.send(Message::text(response.to_string())).await?;
                                on_authenticate::handle_request(
                                    &token,
                                    &client_connection,
                                    ws_stream,
                                    rx,
                                    session,
                                )
                                .await?;
                                let mut map = peer_map.lock().await;
                                if let Some(peer) = map.remove(&token) {
                                    peer.disconnect().await;
                                }
                                break;
                            }
                            Err(c) => {
                                cause = c;
                            }
                        }
                    } else {
                        cause = "Username and password authenticate failed";
                    }
                }
                Err(err) => {
                    cause_cache = format!("Internal error: {:?}", err);
                    cause = cause_cache.as_str();

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
                }
            }
        } else {
            cause = "Sign in message format error";
        }
        let message = format!("Authenticate failed ({})", cause);
        app_config.logger.err(format!("{} for {:?}", message, addr));
        let response = json!({"error": message});
        ws_stream.send(Message::text(response.to_string())).await?;
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
