use crate::ResponseUnit;
use async_trait::async_trait;
use futures::channel::{mpsc, oneshot};
use futures::{lock::Mutex, stream::SplitSink, SinkExt, TryFutureExt};
use hyper::{body::Incoming, upgrade::Upgraded, Request};
use russh_keys::key;
use serde_json::json;
use std::{collections::HashMap, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub struct WebSocketPeer {
    pub client_websocket: Arc<Mutex<ClientWebsocket>>, // websocket from client
    pub client_http: Arc<Mutex<ClientHttp>>,           // http from client
}

impl WebSocketPeer {
    pub fn new(client_connection: Arc<Mutex<ClientWebsocket>>) -> Self {
        Self {
            client_websocket: client_connection,
            client_http: Arc::new(Mutex::new(ClientHttp::new())),
        }
    }

    pub async fn disconnect(&self) {
        tokio::join!(
            async {
                let mut conn = self.client_websocket.lock().await;
                conn.disconnect().await
            },
            async {
                let mut queue = self.client_http.lock().await;
                queue.disconnect()
            }
        );
    }
}

type HttpConnection = (Request<Incoming>, mpsc::Sender<ResponseUnit>);
pub struct ClientHttp {
    request_id: u64,
    queue: HashMap<u64, oneshot::Sender<HttpConnection>>,
}

impl ClientHttp {
    pub fn new() -> Self {
        Self {
            request_id: 0,
            queue: HashMap::new(),
        }
    }

    pub fn register(&mut self, callback: oneshot::Sender<HttpConnection>) -> u64 {
        let id = self.request_id.clone();
        self.request_id += 1;
        self.queue.insert(id.clone(), callback);
        return id;
    }

    pub fn cancel_register(&mut self, id: &u64) {
        self.queue.remove(id);
    }

    pub fn feed(&mut self, id: &u64, response: HttpConnection) {
        let slot = self.queue.remove(id);
        if let Some(sender) = slot {
            let _ = sender.send(response);
        }
    }

    pub fn disconnect(&mut self) {
        self.queue.clear();
    }
}

pub type ClientWriteChannel = SplitSink<WebSocketStream<Upgraded>, Message>;

// @TODO: split ClientConnection [internal_client_stream] and [event_channel]
pub struct ClientWebsocket {
    request_id: u64,
    internal_client_stream: ClientWriteChannel,
    callbacks: HashMap<u64, oneshot::Sender<serde_json::Value>>,
    event_channel: mpsc::Sender<serde_json::Value>,
}

impl ClientWebsocket {
    pub fn new(
        event_channel: mpsc::Sender<serde_json::Value>,
        client_write_channel: ClientWriteChannel,
    ) -> Self {
        Self {
            request_id: 0,
            internal_client_stream: client_write_channel,
            callbacks: HashMap::new(),
            event_channel,
        }
    }

    async fn disconnect(&mut self) {
        let _ = futures::join!(
            self.internal_client_stream.close(),
            self.event_channel.close()
        );
        self.callbacks.clear();
    }

    pub async fn send_request(
        &mut self,
        request: serde_json::Value,
        callback: oneshot::Sender<serde_json::Value>,
    ) -> Result<(), &'static str> {
        let stream = &mut self.internal_client_stream;
        self.request_id += 1;
        let id = self.request_id;
        self.callbacks.insert(id.clone(), callback);
        let request_object = json!({"id": id, "request": request});
        return stream
            .send(Message::Text(request_object.to_string()))
            .map_err(|_| {
                self.callbacks.remove(&id);
                "Websocket send message failed"
            })
            .await;
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
