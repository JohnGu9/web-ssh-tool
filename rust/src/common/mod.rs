pub mod app_config;
pub mod authenticate_queue;
pub mod websocket_peer;

use std::{collections::HashMap, sync::Arc};

use bytes::Bytes;
use futures::{
    channel::{mpsc, oneshot},
    lock::Mutex,
    SinkExt,
};
use http_body_util::StreamBody;
use hyper::{body::Frame, Response};
use tokio::io::{AsyncRead, AsyncReadExt};

use self::{
    app_config::AppConfig,
    authenticate_queue::AuthenticateQueues,
    websocket_peer::{ClientConnection, WebSocketPeer},
};

pub type ResponseUnit = Result<Frame<Bytes>, Box<dyn std::error::Error + Send + Sync>>;
pub type ResponseType = Response<StreamBody<mpsc::Receiver<ResponseUnit>>>;

#[derive(Clone)]
pub struct AppContext {
    pub app_config: Arc<AppConfig>,
    pub websocket_peers: Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    pub authenticate_queues: Arc<Mutex<HashMap<String, AuthenticateQueues>>>,
    pub suspended_clients: Arc<
        Mutex<
            HashMap<
                String,
                (
                    oneshot::Sender<Arc<Mutex<ClientConnection>>>,
                    mpsc::Sender<serde_json::Value>,
                ),
            >,
        >,
    >,
}

pub async fn forward_async_read_to_sender(
    mut file: impl AsyncRead + Unpin,
    mut tx: mpsc::Sender<ResponseUnit>,
) {
    let mut buf = [0_u8; 1024 * 4];
    loop {
        let read_count = file.read(&mut buf).await;
        match read_count {
            Ok(read_count) => {
                if read_count == 0 {
                    break;
                }
                let data = Frame::data(Bytes::from(buf[..read_count].to_vec()));
                if let Err(_) = tx.send(Ok(data)).await {
                    break;
                }
            }
            Err(e) => {
                let e: Box<dyn std::error::Error + Send + Sync> = Box::new(e);
                let _ = tx.send(Err(e)).await;
                break;
            }
        }
    }
}
