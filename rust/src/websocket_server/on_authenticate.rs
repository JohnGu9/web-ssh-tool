use crate::connection_peer::Client;
use crate::connection_peer::ClientConnection;

use super::shell;
use super::shell::PollChannelData;
use futures::{channel::mpsc::Receiver, lock::Mutex, stream::SplitSink, SinkExt, StreamExt};
use hyper::upgrade::Upgraded;
use russh::{self, client::Handle};
use serde_json::json;
use std::{collections::HashMap, error::Error, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    token: &String,
    client_connection: &Arc<Mutex<ClientConnection>>,
    ws_stream: WebSocketStream<Upgraded>,
    event_channel: Receiver<serde_json::Value>,
    session: Handle<Client>,
) -> Result<(), Box<dyn Error>> {
    let (write, read) = ws_stream.split();
    let write = Arc::new(Mutex::new(write));
    let session = Mutex::new(session);
    let shells = Mutex::new(HashMap::new());
    tokio::spawn(poll_event(event_channel, write.clone()));
    read.for_each_concurrent(10, |data| async {
        let text = match data {
            Ok(Message::Text(t)) => t,
            Ok(Message::Binary(bytes)) => match String::from_utf8(bytes) {
                Ok(t) => t,
                Err(_) => return,
            },
            Ok(Message::Ping(bytes)) => {
                let mut write = write.lock().await;
                let _ = write.send(Message::Pong(bytes)).await;
                return;
            }
            _ => return,
        };
        if let Ok(serde_json::Value::Object(mut m)) =
            serde_json::from_str::<serde_json::Value>(text.as_str())
        {
            let tag = m.remove("tag");
            let response = build_response(
                token,
                m.remove(&"request"[..]),
                &client_connection,
                &session,
                &shells,
            )
            .await;

            let message = match response {
                Ok(response) => {
                    json!({"tag": tag, "response": response})
                }
                Err(err) => {
                    let error_result = format!("internal error: {:?}", err);
                    json!({"tag": tag, "response": {"error": error_result}})
                }
            };

            let mut write = write.lock().await;
            let _ = write.send(Message::Text(message.to_string())).await;
            return;
        }
        // unlikely
        let response = json!({"error": "message format error"});
        let mut write = write.lock().await;
        let _ = write.send(Message::text(response.to_string())).await;
    })
    .await;

    Ok(())
}

#[derive(Debug)]
enum RequestError {
    UnknownRequest,
    SshConnectNotEstablish,
    InternalError,
}

async fn poll_event(
    mut event_channel: Receiver<serde_json::Value>,
    tx: Arc<Mutex<SplitSink<WebSocketStream<Upgraded>, Message>>>,
) {
    while let Some(event) = event_channel.next().await {
        let mut tx = tx.lock().await;
        if let Err(_) = tx
            .send(Message::Text(json!({ "event": event }).to_string()))
            .await
        {
            break;
        }
    }
}

async fn build_response(
    token: &String,
    request: Option<serde_json::Value>,
    client_connection: &Arc<Mutex<ClientConnection>>,
    session: &Mutex<Handle<Client>>,
    shells: &Mutex<HashMap<String, futures::channel::mpsc::Sender<PollChannelData>>>,
) -> Result<serde_json::Value, RequestError> {
    if let Some(serde_json::Value::Object(request)) = request {
        for (key, value) in request {
            match key.as_str() {
                "internal" => {}
                "shell" => {
                    return match shell::handle_request(value, &client_connection, &session, &shells)
                        .await
                    {
                        Ok(_) => Ok(serde_json::Value::Null),
                        Err(_) => Err(RequestError::InternalError),
                    };
                }
                "token" => {
                    return Ok(json!(token));
                }
                key => {
                    let (tx, rx) = futures::channel::oneshot::channel();
                    let mut m = serde_json::Map::new();
                    m.insert(key.to_string(), value);

                    {
                        let mut conn = client_connection.lock().await;
                        if let Err(_) = conn.send_request(m, tx).await {
                            return Err(RequestError::SshConnectNotEstablish);
                        }
                    }

                    match rx.await {
                        Ok(value) => {
                            return Ok(value);
                        }
                        Err(_) => {
                            return Err(RequestError::InternalError);
                        }
                    }
                }
            }
        }
    }
    return Err(RequestError::UnknownRequest);
}
