mod assets_map;
mod external_file_send;
mod internal_file_send;

use external_file_send::external_file_send;
use internal_file_send::internal_file_send;

use super::not_found::not_found;
use crate::{common::app_config::AppConfig, ResponseType};
use hyper::{header, http::HeaderValue, Request};
use std::{convert::Infallible, sync::Arc};

pub async fn file_send(
    app_config: &Arc<AppConfig>,
    req: &Request<hyper::body::Incoming>,
    filename: &str,
) -> Result<ResponseType, Infallible> {
    let res = match &app_config.assets_path {
        Some(assets_path) => external_file_send(assets_path, filename)
            .await
            .map_err(|_| ()),
        None => internal_file_send(filename, &req).await,
    };
    match res {
        Ok(mut res) => {
            let guess = mime_guess::from_path(filename);
            let guess = guess.first_or_text_plain();
            let mime = HeaderValue::from_str(guess.to_string().as_str())
                .unwrap_or(HeaderValue::from_static("text/plain"));
            let headers = res.headers_mut();
            headers.append(header::CONTENT_TYPE, mime);
            headers.append(
                header::CACHE_CONTROL,
                HeaderValue::from_static("min-fresh=5"),
            );
            Ok(res)
        }
        Err(_) => Ok(not_found(app_config, format!("No such file: {}", filename)).await),
    }
}
