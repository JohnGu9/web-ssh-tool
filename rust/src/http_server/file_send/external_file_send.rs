use super::super::components::file_to_stream;
use crate::components::ResponseType;
use http_body_util::StreamBody;
use hyper::Response;
use std::{error::Error, path::PathBuf};

pub async fn external_file_send(
    assets_path: &PathBuf,
    filename: &str,
) -> Result<ResponseType, Box<dyn Error + Send + Sync>> {
    let filename = assets_path.join(filename);
    let file = tokio::fs::File::open(filename).await?;
    Ok(Response::new(StreamBody::new(file_to_stream(file))))
}
