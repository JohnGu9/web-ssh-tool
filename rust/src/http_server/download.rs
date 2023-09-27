use super::components::request_internal_client_http_connection;
use super::not_found::not_found;
use crate::common::{
    app_config::AppConfig,
    websocket_peer::{ClientHttp, ClientWebsocket},
    ResponseType,
};
use futures::lock::Mutex;
use hyper::{body::Incoming, Request};
use serde_json::json;
use std::{convert::Infallible, sync::Arc};

pub async fn on_download(
    app_config: &Arc<AppConfig>,
    req: Request<Incoming>,
    queue: Arc<Mutex<ClientHttp>>,
    conn: Arc<Mutex<ClientWebsocket>>,
    files: Vec<String>,
) -> Result<ResponseType, Infallible> {
    {
        let mut conn = conn.lock().await;
        let _ = conn
            .forward_event(json!({"notification": "Downloading file(s)"}))
            .await;
    }
    match request_internal_client_http_connection(
        app_config,
        req,
        queue,
        conn,
        json!({"download": files}),
    )
    .await
    {
        Ok(res) => Ok(res),
        Err(e) => Ok(not_found(app_config, e).await),
    }
}
