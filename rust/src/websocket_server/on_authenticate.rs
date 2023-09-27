use super::encode_value;
use super::internal_decompress;
use super::shell;
use super::shell::PollChannelData;
use crate::common::websocket_peer::{Client, ClientWebsocket};
use futures::{
    channel::{mpsc, oneshot},
    lock::Mutex,
    stream::SplitSink,
    SinkExt, StreamExt,
};
use hyper::upgrade::Upgraded;
use russh::{self, client::Handle};
use serde_json::json;
use std::{collections::HashMap, error::Error, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    token: &String,
    client_connection: &Arc<Mutex<ClientWebsocket>>,
    ws_stream: WebSocketStream<Upgraded>,
    event_channel: mpsc::Receiver<serde_json::Value>,
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
            Ok(Message::Binary(bytes)) => match internal_decompress(&bytes[..]) {
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
            let request = m.remove("request");
            let response =
                build_response(token, request, &client_connection, &session, &shells).await;

            let message = match response {
                Ok(response) => {
                    json!({"tag": tag, "response": response})
                }
                Err(err) => {
                    let error_result = format!("internal error: {:?}", err);
                    json!({"tag": tag, "response": {"error": error_result}})
                }
            };

            let msg = encode_value(message);
            let mut write = write.lock().await;
            let _ = write.send(msg).await;
            return;
        }
        // unlikely
        let msg = encode_value(json!({"error": "message format error"}));
        let mut write = write.lock().await;
        let _ = write.send(msg).await;
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
    mut event_channel: mpsc::Receiver<serde_json::Value>,
    tx: Arc<Mutex<SplitSink<WebSocketStream<Upgraded>, Message>>>,
) {
    while let Some(event) = event_channel.next().await {
        let msg = encode_value(json!({ "event": event }));
        let mut tx = tx.lock().await;
        if let Err(_) = tx.send(msg).await {
            break;
        }
    }
}

async fn build_response(
    token: &String,
    request: Option<serde_json::Value>,
    client_connection: &Arc<Mutex<ClientWebsocket>>,
    session: &Mutex<Handle<Client>>,
    shells: &Mutex<HashMap<String, mpsc::Sender<PollChannelData>>>,
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
                    let (tx, rx) = oneshot::channel();

                    {
                        let mut conn = client_connection.lock().await;
                        if let Err(_) = conn.send_request(json!({key: value}), tx).await {
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
