use super::components::request_internal_client_http_connection;
use super::not_found::not_found;
use crate::common::{
    app_config::AppConfig,
    connection_peer::{ClientConnection, ClientResponseQueue},
    ResponseType,
};
use futures::lock::Mutex;
use hyper::{body::Incoming, Request};
use serde_json::json;
use std::{convert::Infallible, sync::Arc};

pub async fn on_upload(
    app_config: &Arc<AppConfig>,
    req: Request<Incoming>,
    queue: Arc<Mutex<ClientResponseQueue>>,
    conn: Arc<Mutex<ClientConnection>>,
    dir: &str,
    filename: Option<String>,
) -> Result<ResponseType, Infallible> {
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
