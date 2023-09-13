use crate::ResponseUnit;
use async_trait::async_trait;
use futures::channel::{mpsc, oneshot};
use futures::{lock::Mutex, stream::SplitSink, SinkExt, TryFutureExt};
use hyper::{body::Incoming, upgrade::Upgraded, Request};
use russh_keys::key;
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub struct WebSocketPeer {
    pub token: String,
    pub addr: SocketAddr,
    pub client_connection: Arc<Mutex<ClientConnection>>, // websocket from client
    pub client_response_queue: Arc<Mutex<ClientResponseQueue>>, // http from client
}

impl WebSocketPeer {
    pub fn new(
        token: String,
        addr: SocketAddr,
        event_channel: mpsc::Sender<serde_json::Value>,
    ) -> Self {
        Self {
            token: token,
            addr: addr,
            client_connection: Arc::new(Mutex::new(ClientConnection::new(event_channel))),
            client_response_queue: Arc::new(Mutex::new(ClientResponseQueue::new())),
        }
    }

    pub async fn disconnect(&self) {
        let f1 = async {
            let mut conn = self.client_connection.lock().await;
            conn.disconnect().await
        };
        let f2 = async {
            let mut queue = self.client_response_queue.lock().await;
            queue.disconnect()
        };
        tokio::join!(f1, f2);
    }
}

type QueueType = (Request<Incoming>, mpsc::Sender<ResponseUnit>);
pub struct ClientResponseQueue {
    request_id: u64,
    queue: HashMap<u64, oneshot::Sender<QueueType>>,
}

impl ClientResponseQueue {
    pub fn new() -> Self {
        Self {
            request_id: 0,
            queue: HashMap::new(),
        }
    }

    pub fn register(&mut self, callback: oneshot::Sender<QueueType>) -> u64 {
        let id = self.request_id.clone();
        self.request_id += 1;
        self.queue.insert(id.clone(), callback);
        return id;
    }

    pub fn cancel_register(&mut self, id: &u64) {
        self.queue.remove(id);
    }

    pub fn feed(&mut self, id: &u64, response: QueueType) {
        let slot = self.queue.remove(id);
        if let Some(sender) = slot {
            let _ = sender.send(response);
        }
    }

    pub fn disconnect(&mut self) {
        self.queue.clear();
    }
}

pub struct ClientConnection {
    request_id: u64,
    internal_client_stream: Option<SplitSink<WebSocketStream<Upgraded>, Message>>,
    callbacks: HashMap<u64, oneshot::Sender<serde_json::Value>>,
    event_channel: mpsc::Sender<serde_json::Value>,
}

impl ClientConnection {
    pub fn new(event_channel: mpsc::Sender<serde_json::Value>) -> Self {
        Self {
            request_id: 0,
            internal_client_stream: None,
            callbacks: HashMap::new(),
            event_channel,
        }
    }

    async fn disconnect(&mut self) {
        if let Some(ref mut stream) = self.internal_client_stream {
            let _ = stream.close().await;
        }
        self.callbacks.clear();
        let _ = self.event_channel.close().await;
    }

    pub fn set_internal_client_stream(
        &mut self,
        stream: SplitSink<WebSocketStream<Upgraded>, Message>,
    ) {
        self.internal_client_stream = Some(stream);
    }

    pub fn clear_internal_client_stream(&mut self) {
        self.internal_client_stream = None;
    }

    pub async fn send_request(
        &mut self,
        request: serde_json::Map<String, serde_json::Value>,
        callback: oneshot::Sender<serde_json::Value>,
    ) -> Result<(), &'static str> {
        if let Some(ref mut stream) = self.internal_client_stream {
            self.request_id += 1;
            let id = self.request_id;
            self.callbacks.insert(id.clone(), callback);
            let mut m = serde_json::Map::new();
            m.insert(
                "id".to_string(),
                serde_json::Value::Number(id.clone().into()),
            );
            m.insert("request".to_string(), serde_json::Value::Object(request));
            let request_object = serde_json::Value::Object(m);
            return stream
                .send(Message::Text(request_object.to_string()))
                .map_err(|_| {
                    self.callbacks.remove(&id);
                    "Websocket send message failed"
                })
                .await;
        }
        Err("No internet client")
    }

    pub fn feed_response(
        &mut self,
        id: serde_json::Value,
        response: serde_json::Value,
    ) -> Result<(), FeedResponseError> {
        if let Some(id) = id.as_u64() {
            if let Some(callback) = self.callbacks.remove(&id) {
                let _ = callback.send(response);
                return Ok(());
            } else {
                return Err(FeedResponseError::NoRegisteredCallback(id));
            }
        } else {
            return Err(FeedResponseError::UnknownId(id));
        }
    }

    pub async fn forward_event(&mut self, value: serde_json::Value) -> Result<(), SendEventError> {
        self.event_channel
            .send(value)
            .await
            .map_err(|_| SendEventError::EventChannelClosed)
    }
}

#[derive(Debug)]
pub enum FeedResponseError {
    UnknownId(serde_json::Value),
    NoRegisteredCallback(u64),
}

#[derive(Debug)]
pub enum SendEventError {
    EventChannelClosed,
}

pub struct Client {}

#[async_trait]
impl russh::client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(self, _: &key::PublicKey) -> Result<(Self, bool), Self::Error> {
        Ok((self, true))
    }
}
