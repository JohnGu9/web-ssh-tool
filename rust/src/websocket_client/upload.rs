use super::components::{http_to_master, ArgumentsError};
use crate::common::app_config::AppConfig;
use bytes::Bytes;
use futures::SinkExt;
use http_body_util::{BodyExt, StreamBody};
use hyper::{body::Frame, header, http::HeaderValue, Method, Request};
use serde_json::json;
use std::{path::Path, sync::Arc};
use tokio::io::AsyncWriteExt;

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    token: &String,
    id: u64,
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let mut argus = None;
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 1 {
            if let serde_json::Value::String(dir) = &array[0] {
                argus = Some((dir, None));
            }
        } else if array.len() == 2 {
            if let (serde_json::Value::String(dir), serde_json::Value::String(filename)) =
                (&array[0], &array[1])
            {
                argus = Some((dir, Some(filename)));
            }
        }
    }
    match argus {
        Some((dir_str, filename)) => {
            use futures::channel::mpsc::channel;
            let (mut tx, rx) = channel(0);
            let body = StreamBody::new(rx);
            let mut req = Request::new(body);
            *req.uri_mut() = "/client".parse()?;
            *req.method_mut() = Method::PUT;
            let headers = req.headers_mut();
            let dir = Path::new(dir_str.as_str());
            let temp = match filename {
                Some(filename) => filename.to_string(),
                None => {
                    let uuid = uuid::Uuid::new_v4();
                    format!("{}.temp", uuid)
                }
            };
            let file_path = dir.join(temp.clone());
            let (sender, file) = tokio::join!(
                http_to_master(app_config),
                tokio::fs::File::create(file_path.clone()),
            );
            let mut sender = sender?;
            let bytes = match &file {
                Ok(_) => {
                    let file_path = match file_path.to_str() {
                        Some(file_path) => file_path,
                        None => temp.as_str(),
                    };
                    let message = json!({
                        "destination": dir_str,
                        "filename": temp,
                        "path": file_path,
                    })
                    .to_string();
                    let bytes: Bytes = message.into();
                    bytes
                }
                Err(e) => {
                    let e = format!("{:?}", e);
                    let message = json!({"error": e}).to_string();
                    let bytes: Bytes = message.into();
                    bytes
                }
            };

            headers.append("id", HeaderValue::from_str(id.to_string().as_str())?);
            headers.append("peer", HeaderValue::from_str(token.as_str())?);
            headers.append(
                header::CONTENT_TYPE,
                HeaderValue::from_str(mime_guess::mime::TEXT_PLAIN.to_string().as_str())?,
            );
            headers.append(
                header::CONTENT_LENGTH,
                HeaderValue::from_str(bytes.len().to_string().as_str())?,
            );
            headers.append(header::CONNECTION, HeaderValue::from_static("close"));

            let mut response = sender.send_request(req).await?;

            if let Ok(mut file) = file {
                // @TODO: maybe delete file if any error occurred
                tokio::spawn(async move {
                    let body = response.body_mut();
                    while let Some(Ok(mut frame)) = body.frame().await {
                        if let Some(data) = frame.data_mut() {
                            let vec = data.to_vec();
                            if let Err(_) = file.write_all(&vec[..]).await {
                                break;
                            }
                        }
                    }
                    // only response body after receive full file
                    // if send body before receive full file, the socket will be closed unexpectedly
                    let _ = tx.send(Ok(Frame::data(bytes))).await;
                    let _ = sender; // prevent socket from closing
                });
            }

            Ok(json!(null))
        }
        None => Err(Box::new(ArgumentsError(Some(format!("no paths"))))),
    }
}
