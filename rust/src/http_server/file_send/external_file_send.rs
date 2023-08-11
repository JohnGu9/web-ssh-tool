use super::super::components::file_to_stream;
use crate::components::ResponseType;
use http_body_util::StreamBody;
use hyper::{header, http::HeaderValue, Response};
use std::{error::Error, path::PathBuf};

pub async fn external_file_send(
    assets_path: &PathBuf,
    filename: &str,
) -> Result<ResponseType, Box<dyn Error + Send + Sync>> {
    let filename = assets_path.join(filename);
    let file = tokio::fs::File::open(filename).await?;
    let size_header = match file.metadata().await {
        Ok(metadata) => match HeaderValue::from_str(metadata.len().to_string().as_str()) {
            Ok(h) => Some(h),
            Err(_) => None,
        },
        Err(_) => None,
    };
    let mut res = Response::new(StreamBody::new(file_to_stream(file)));
    if let Some(h) = size_header {
        res.headers_mut().append(header::CONTENT_LENGTH, h);
    } else {
        res.headers_mut().append(
            header::TRANSFER_ENCODING,
            HeaderValue::from_static("chunked"),
        );
    }
    Ok(res)
}
