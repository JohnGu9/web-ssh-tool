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

pub async fn on_upload(
    app_config: &Arc<AppConfig>,
    req: Request<Incoming>,
    queue: Arc<Mutex<ClientHttp>>,
    conn: Arc<Mutex<ClientWebsocket>>,
    dir: &str,
    filename: Option<String>,
) -> Result<ResponseType, Infallible> {
    {
        let mut conn = conn.lock().await;
        let msg = format!("Uploading a file to [{}]. ", dir);
        let _ = conn.forward_event(json!({"notification": msg})).await;
    }
    let m = match filename {
        Some(filename) => json!([dir, filename,]),
        None => json!([dir,]),
    };
    match request_internal_client_http_connection(
        app_config,
        req,
        queue,
        conn,
        json!({"upload": m}),
    )
    .await
    {
        Ok(res) => Ok(res),
        Err(e) => Ok(not_found(app_config, e).await),
    }
}
