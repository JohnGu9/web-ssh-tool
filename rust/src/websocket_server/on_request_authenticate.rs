use super::encode_value;
use super::internal_decompress;
use super::on_authenticate;
use crate::app_config::AppConfig;
use crate::connection_peer::Client;
use crate::connection_peer::WebSocketPeer;
use futures::channel::{mpsc, oneshot};
use futures::lock::Mutex;
use futures::{SinkExt, StreamExt};
use hyper::{upgrade::Upgraded, Request};
use serde_json::json;
use std::{collections::HashMap, error::Error, net::SocketAddr, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    authenticate_queues: &Arc<Mutex<HashMap<String, mpsc::Sender<oneshot::Receiver<()>>>>>,
    addr: &SocketAddr,
    _: Request<hyper::body::Incoming>,
    mut ws_stream: WebSocketStream<Upgraded>,
) -> Result<(), Box<dyn Error>> {
    app_config
        .logger
        .info(format!("New websocket connection({}) connected", addr));

    let config = russh::client::Config::default();
    let config = Arc::new(config);

    let mut token_and_connection = None;

    while let Some(Ok(data)) = ws_stream.next().await {
        let text = match data {
            Message::Text(t) => t,
            Message::Binary(bytes) => match internal_decompress(&bytes[..]) {
                Ok(t) => t,
                Err(_) => continue,
            },
            Message::Ping(bytes) => {
                ws_stream.send(Message::Pong(bytes)).await?;
                continue;
            }
            _ => continue,
        };

        let mut cause_cache = String::new();
        let result = async {
            let (username, password) = match parse_username_and_password(text) {
                Some((username, password)) => (username, password),
                None => return Err("Sign in message format error"),
            };

            let sh = Client {};
            let mut session = match russh::client::connect(
                config.clone(),
                format!("localhost:{}", app_config.local_ssh_port),
                sh,
            )
            .await
            {
                Ok(session) => session,
                Err(err) => {
                    cause_cache = format!("Internal error: {:?}", err);
                    return Err(cause_cache.as_str());
                }
            };

            // limit one user authentication at the same time
            let (complete_authenticate, rx) = oneshot::channel();
            let mut authenticate_queue = {
                let mut lock = authenticate_queues.lock().await;
                match lock.get(&username) {
                    Some(sender) => sender.clone(),
                    None => {
                        let (t, mut r) = mpsc::channel(0);
                        tokio::spawn(async move {
                            while let Some(rx) = r.next().await {
                                let _ = rx.await;
                            }
                        });
                        lock.insert(username.clone(), t.clone());
                        t
                    }
                }
            };
            let _ = authenticate_queue.send(rx).await;
            match session.authenticate_password(username, password).await {
                Ok(false) => {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_secs(5)).await;
                    tokio::task::yield_now().await;
                    return Err("Username and password authenticate failed");
                }
                Err(err) => {
                    cause_cache = format!("Internal error: {:?}", err);
                    return Err(cause_cache.as_str());
                }
                _ => {}
            };
            let _ = complete_authenticate.send(());

            let mut map = peer_map.lock().await;
            let token_uuid = uuid::Uuid::new_v4();
            let token = token_uuid.to_string();
            if let Some(_) = map.get(&token) {
                return Err("Internal error: id generation failed");
            }
            if let Some(_) = map.iter().find(|(_, value)| value.addr == *addr) {
                return Err("User already sign in");
            }

            let mut channel = match session.channel_open_session().await {
                Ok(ch) => ch,
                Err(err) => {
                    cause_cache = format!("Local ssh establishing failed: {:?}", err);
                    return Err(cause_cache.as_str());
                }
            };

            let command = format!(
                "{} --client {} --listen-address localhost:{}",
                app_config.bin, token, app_config.listen_address.port
            );
            let (tx, rx) = futures::channel::mpsc::channel(1);
            tokio::spawn(async move { channel.exec(true, command).await });
            let peer = WebSocketPeer::new(token.clone(), addr.clone(), tx);
            let client_connection = peer.client_connection.clone();
            map.insert(token.clone(), peer);
            return Ok((session, token, client_connection, rx));
        }
        .await;

        match result {
            Err(cause) => {
                let message = format!("Authenticate failed ({})", cause);
                app_config.logger.err(format!("{} for {:?}", message, addr));
                let response = json!({"error": message});
                let msg = encode_value(response);
                ws_stream.send(msg).await?;
            }
            Ok(res) => {
                token_and_connection = Some(res);
                break;
            }
        }
    }

    if let Some((session, token, client_connection, rx)) = token_and_connection {
        let response = json!({ "token": token });
        let msg = encode_value(response);
        if let Ok(_) = ws_stream.send(msg).await {
            let _ =
                on_authenticate::handle_request(&token, &client_connection, ws_stream, rx, session)
                    .await;
        }
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
