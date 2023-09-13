use crate::common::{
    app_config::AppConfig,
    websocket_peer::{ClientConnection, ClientResponseQueue},
    forward_async_read_to_sender, ResponseType,
};
use crate::ResponseUnit;
use futures::channel::{mpsc, oneshot};
use futures::lock::Mutex;
use futures::SinkExt;
use http_body_util::{BodyExt, StreamBody};
use hyper::body::Incoming;
use hyper::{Request, Response};
use serde_json::json;
use std::sync::Arc;

pub fn file_to_stream(file: tokio::fs::File) -> mpsc::Receiver<ResponseUnit> {
    let (tx, rx) = mpsc::channel(1);
    tokio::spawn(forward_async_read_to_sender(file, tx));
    return rx;
}

pub async fn forward_body_to_sender(mut body: Incoming, mut sender: mpsc::Sender<ResponseUnit>) {
    while let Some(f) = body.frame().await {
        let f = match f {
            Ok(f) => Ok(f),
            Err(e) => {
                let e: Box<dyn std::error::Error + Send + Sync> = Box::new(e);
                Err(e)
            }
        };
        if let Err(_) = sender.send(f).await {
            break; // error cause by receiver dropped, no need to send more data to sender
        };
    }
}

pub const BUF_SIZE: usize = 64;

pub async fn request_internal_client_http_connection(
    app_config: &Arc<AppConfig>,
    req: Request<Incoming>,
    queue: Arc<Mutex<ClientResponseQueue>>,
    conn: Arc<Mutex<ClientConnection>>,
    api_call: serde_json::Value,
) -> Result<ResponseType, InternalClientHttpConnectionError> {
    let (tx, rx) = oneshot::channel();
    let id = {
        let mut queue = queue.lock().await;
        queue.register(tx)
    };
    {
        let (tx, rx) = oneshot::channel();
        {
            let mut m = serde_json::Map::new();
            m.insert("internal".to_string(), json!([id, api_call]));
            let result = {
                let mut conn = conn.lock().await;
                conn.send_request(m, tx).await
            };
            if let Err(_) = result {
                {
                    let mut queue = queue.lock().await;
                    queue.cancel_register(&id);
                }
                return Err(InternalClientHttpConnectionError::LostInternalClientConnection);
            }
        }
        match rx.await {
            Ok(serde_json::Value::Null) => {}
            e => {
                {
                    let mut queue = queue.lock().await;
                    queue.cancel_register(&id);
                }
                app_config.logger.err(format!("upload error {:?}", e));
                return Err(InternalClientHttpConnectionError::InternalClientRejectConnection);
            }
        }
    }
    let internal_client_req = rx.await;
    match internal_client_req {
        Ok((internal_req, internal_tx)) => {
            let (req_parts, req_body) = req.into_parts();
            let (internal_parts, internal_body) = internal_req.into_parts();
            let (tx, rx) = mpsc::channel(BUF_SIZE);
            let body = StreamBody::new(rx);
            let mut response = Response::new(body);
            *response.extensions_mut() = internal_parts.extensions;
            *response.version_mut() = internal_parts.version.to_owned();
            *response.headers_mut() = internal_parts.headers.to_owned();
            *response.version_mut() = req_parts.version;
            tokio::spawn(forward_body_to_sender(internal_body, tx));
            tokio::spawn(forward_body_to_sender(req_body, internal_tx));
            return Ok(response);
        }
        _ => {
            return Err(InternalClientHttpConnectionError::Unknown);
        }
    }
}

#[derive(Debug, Clone)]
pub enum InternalClientHttpConnectionError {
    LostInternalClientConnection,
    InternalClientRejectConnection,
    Unknown,
}

impl std::fmt::Display for InternalClientHttpConnectionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self)
    }
}
impl std::error::Error for InternalClientHttpConnectionError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}
