use bytes::Bytes;
use futures::{channel::mpsc::channel, SinkExt};
use http_body_util::StreamBody;
use hyper::{body::Frame, header, http::HeaderValue, Response};

use super::assets_map::assets_map;
use crate::components::ResponseType;

pub async fn internal_file_send(filename: &str) -> Result<ResponseType, ()> {
    match assets_map(filename) {
        Ok(v) => {
            let (mut tx, rx) = channel(1);
            let body = StreamBody::new(rx);
            let mut res = Response::new(body);
            if let Ok(h) = HeaderValue::from_str(v.len().to_string().as_str()) {
                res.headers_mut().append(header::CONTENT_LENGTH, h);
            } else {
                res.headers_mut().append(
                    header::TRANSFER_ENCODING,
                    HeaderValue::from_static("chunked"),
                );
            }
            let _ = tx.send(Ok(Frame::data(Bytes::from_static(v)))).await;
            Ok(res)
        }
        Err(_) => Err(()),
    }
}
