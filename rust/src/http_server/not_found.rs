use bytes::Bytes;
use futures::{channel::mpsc::channel, SinkExt};
use http_body_util::StreamBody;
use hyper::{body::Frame, Response, StatusCode};
use std::sync::Arc;

use crate::common::{app_config::AppConfig, ResponseType};

pub async fn not_found(app_config: &Arc<AppConfig>, error: impl std::fmt::Debug) -> ResponseType {
    let message = format!("{:?}", error);
    app_config.logger.err(message.clone());
    let (mut tx, rx) = channel(1);
    let _ = tx.send(Ok(Frame::data(Bytes::from(message)))).await;
    let body = StreamBody::new(rx);
    let mut response = Response::new(body);
    *(response.status_mut()) = StatusCode::NOT_FOUND;
    return response;
}
