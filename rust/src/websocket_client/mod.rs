mod components;
mod download;
mod fs_api;
mod preview;
mod unzip;
mod upload;
mod watch;

use crate::common::app_config::AppConfig;
use futures::{
    channel::mpsc::{channel, Receiver, Sender},
    lock::Mutex,
    stream::SplitSink,
    SinkExt, StreamExt,
};
use serde_json::json;
use std::{collections::HashMap, error::Error, sync::Arc};
use tokio::net::TcpStream;
use tokio_tungstenite::{tungstenite::Message, MaybeTlsStream, WebSocketStream};

use self::components::ArgumentsError;

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    token: &String,
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
) -> Result<(), Box<dyn Error>> {
    let (write, read) = ws_stream.split();
    let write = Arc::new(Mutex::new(write));
    let watchers = Mutex::new(HashMap::new());
    let (tx, rx) = channel(0); // event_channel
    tokio::spawn(poll_event(rx, write.clone()));

    read.for_each_concurrent(None, |data| async {
        if let Ok(Message::Text(text)) = data {
            fn handle_error(err: Box<dyn std::error::Error>) -> serde_json::Value {
                let result = format!("{:?}", err);
                json!({ "error": result })
            }
            if let Ok(serde_json::Value::Object(mut m)) =
                serde_json::from_str::<serde_json::Value>(text.as_str())
            {
                if let (Some(id), Some(serde_json::Value::Object(request))) =
                    (m.remove("id"), m.remove("request"))
                {
                    for (key, value) in request.iter() {
                        let result = handle_call(app_config, token, key, value, &tx, &watchers)
                            .await
                            .unwrap_or_else(handle_error);
                        let mut write = write.lock().await;
                        let _ = write
                            .send(Message::text(
                                json!({"id":id, "response":result}).to_string(),
                            ))
                            .await;
                        return;
                    }
                }
            }
        }
        let mut write = write.lock().await;
        let _ = write
            .send(Message::text(
                json!({"error": "message parse failed"}).to_string(),
            ))
            .await;
    })
    .await;
    Ok(())
}

async fn poll_event(
    mut rx: Receiver<serde_json::Value>,
    tx: Arc<Mutex<SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>>>,
) {
    while let Some(e) = rx.next().await {
        let mut tx = tx.lock().await;
        if let Err(_) = tx
            .send(Message::Text(json!({ "event": e }).to_string()))
            .await
        {
            break;
        }
    }
}

async fn handle_call(
    app_config: &Arc<AppConfig>,
    token: &String,
    call: &String,
    argument: &serde_json::Value,
    event_channel: &Sender<serde_json::Value>,
    watchers: &Mutex<HashMap<String, Arc<Mutex<watch::MyWatcher>>>>,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    match call.as_str() {
        "fs.access" => fs_api::fs_access(argument).await,
        "fs.unlink" => fs_api::fs_unlink(argument).await,
        "fs.rm" => fs_api::fs_rm(argument).await,
        "fs.rename" => fs_api::fs_rename(argument).await,
        "fs.exists" => fs_api::fs_exists(argument).await,
        "fs.mkdir" => fs_api::fs_mkdir(argument).await,
        "fs.writeFile" => fs_api::fs_write_file(argument).await,
        "fs.cp" => fs_api::fs_cp(argument).await,
        "fs.trash" => fs_api::fs_trash(argument).await,
        "unzip" => unzip::handle_request(argument).await,
        "watch" => watch::handle_request(argument, event_channel, watchers).await,
        "internal" => handle_internal(app_config, token, argument).await,
        _ => Err(Box::new(Unimplemented())),
    }
}

async fn handle_internal(
    app_config: &Arc<AppConfig>,
    token: &String,
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(argument) = argument {
        if argument.len() == 2 {
            if let (serde_json::Value::Number(id), serde_json::Value::Object(argument)) =
                (&argument[0], &argument[1])
            {
                if let Some(id) = id.as_u64() {
                    for (key, argument) in argument.iter() {
                        match key.as_str() {
                            "download" => {
                                return download::handle_request(app_config, token, id, argument)
                                    .await;
                            }
                            "upload" => {
                                return upload::handle_request(app_config, token, id, argument)
                                    .await;
                            }
                            "preview" => {
                                return preview::handle_request(app_config, token, id, argument)
                                    .await;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(Some(format!("no id")))));
}

#[derive(Debug, Clone)]
pub struct Unimplemented();

impl std::fmt::Display for Unimplemented {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Unimplemented")
    }
}
impl std::error::Error for Unimplemented {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}
