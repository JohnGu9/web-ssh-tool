mod external_file_send;
mod internal_file_send;
mod assets_map;
use external_file_send::external_file_send;
use internal_file_send::internal_file_send;

use super::not_found::not_found;
use crate::{app_config::AppConfig, ResponseType};
use std::{convert::Infallible, sync::Arc};

pub async fn file_send(
    app_config: &Arc<AppConfig>,
    filename: &str,
) -> Result<ResponseType, Infallible> {
    match &app_config.assets_path {
        Some(assets_path) => match external_file_send(assets_path, filename).await {
            Ok(res) => Ok(res),
            Err(_) => Ok(not_found(app_config, format!("No such file: {}", filename)).await),
        },
        None => match internal_file_send(filename).await {
            Ok(res) => Ok(res),
            Err(_) => Ok(not_found(app_config, format!("No such file: {}", filename)).await),
        },
    }
}
