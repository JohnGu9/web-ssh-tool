mod assets_map;
mod external_file_send;
mod internal_file_send;
use external_file_send::external_file_send;
use hyper::{header, http::HeaderValue};
use internal_file_send::internal_file_send;

use super::not_found::not_found;
use crate::{app_config::AppConfig, ResponseType};
use std::{convert::Infallible, sync::Arc};

pub async fn file_send(
    app_config: &Arc<AppConfig>,
    filename: &str,
) -> Result<ResponseType, Infallible> {
    let guess = mime_guess::from_path(filename);
    let guess = guess.first_or_text_plain();
    let mime = HeaderValue::from_str(guess.to_string().as_str())
        .unwrap_or(HeaderValue::from_static("text/plain"));
    match &app_config.assets_path {
        Some(assets_path) => match external_file_send(assets_path, filename).await {
            Ok(mut res) => {
                res.headers_mut().append(header::CONTENT_TYPE, mime);
                Ok(res)
            }
            Err(_) => Ok(not_found(app_config, format!("No such file: {}", filename)).await),
        },
        None => match internal_file_send(filename).await {
            Ok(mut res) => {
                res.headers_mut().append(header::CONTENT_TYPE, mime);
                Ok(res)
            }
            Err(_) => Ok(not_found(app_config, format!("No such file: {}", filename)).await),
        },
    }
}
