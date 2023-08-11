use super::components::{file_to_stream, http_to_master, ArgumentsError};
use crate::app_config::AppConfig;
use futures::channel::oneshot;
use http_body_util::{BodyExt, StreamBody};
use hyper::{header, http::HeaderValue, Method, Request};
use serde_json::json;
use std::{path::Path, sync::Arc};

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    token: &String,
    id: u64,
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::String(argument) = argument {
        let path = Path::new(argument.as_str());
        let guess = mime_guess::from_path(path);
        let guess = guess.first_or_text_plain();
        let file = tokio::fs::File::open(path).await?;
        let size = match file.metadata().await {
            Ok(meta) => Some(meta.len()),
            Err(_) => None,
        };
        let (on_end_callback, on_end) = oneshot::channel();
        let rx = file_to_stream(file, on_end_callback);
        let mut sender = http_to_master(app_config).await?;
        let body = StreamBody::new(rx);
        let mut req = Request::new(body);
        *req.uri_mut() = "/client".parse()?;
        *req.method_mut() = Method::PUT;
        let headers = req.headers_mut();
        headers.append("id", HeaderValue::from_str(id.to_string().as_str())?);
        headers.append("peer", HeaderValue::from_str(token.as_str())?);
        headers.append(header::CONNECTION, HeaderValue::from_static("close"));
        headers.append(
            header::CONTENT_TYPE,
            HeaderValue::from_str(guess.to_string().as_str())?,
        );
        match size {
            Some(size) => headers.append(
                header::CONTENT_LENGTH,
                HeaderValue::from_str(size.to_string().as_str())?,
            ),
            None => headers.append(
                header::TRANSFER_ENCODING,
                HeaderValue::from_static("chunked"),
            ),
        };
        headers.append(
            header::CONNECTION,
            HeaderValue::from_static("close"),
        );

        let mut response = sender.send_request(req).await?;
        tokio::spawn(async move {
            let body = response.body_mut();
            while let Some(Ok(_)) = body.frame().await {}
        });
        tokio::spawn(async move {
            let _ = on_end.await;
            let _ = sender; // prevent socket from closing when sending files
        });
        return Ok(json!(null));
    }
    return Err(Box::new(ArgumentsError(Some(format!("no paths")))));
}
