use crate::common::{websocket_peer::ClientConnection, AppContext};
use futures::{lock::Mutex, StreamExt};
use hyper::upgrade::Upgraded;
use std::{error::Error, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    context: AppContext,
    ws_stream: WebSocketStream<Upgraded>,
    token: &str,
) -> Result<(), Box<dyn Error>> {
    let app_config = &context.app_config;
    let suspended_clients = &context.suspended_clients;
    let result = {
        let mut map = suspended_clients.lock().await;
        map.remove(token)
    };
    if let Some((callback, event_channel)) = result {
        let (write, read) = ws_stream.split();
        let client_connection = Arc::new(Mutex::new(ClientConnection::new(event_channel, write)));
        if let Err(_) = callback.send(client_connection.clone()) {
            app_config.logger.err(format!(
                "Not found token({}) in current connecting peers",
                token
            ));
            return Ok(());
        }

        app_config
            .logger
            .info(format!("Internal client for token({}) connected", token));
        read.for_each_concurrent(10, |data| async {
            if let Ok(Message::Text(text)) = data {
                if let Ok(serde_json::Value::Object(mut m)) =
                    serde_json::from_str::<serde_json::Value>(text.as_str())
                {
                    let mut conn = client_connection.lock().await;
                    if let (Some(id), Some(response)) = (m.remove("id"), m.remove("response")) {
                        if let Err(err) = conn.feed_response(id, response) {
                            app_config.logger.info(format!(
                                "Internal client for token({}) failed to feed response ({:?})",
                                token, err
                            ));
                        }
                        return;
                    } else if let Some(event) = m.remove("event") {
                        if let Err(err) = conn.forward_event(event).await {
                            app_config.logger.info(format!(
                                "Internal client for token({}) failed to forward event ({:?})",
                                token, err
                            ));
                        }
                        return;
                    }
                }
                app_config.logger.err(format!(
                    "Unknown message from client  for token({}): {}",
                    token, text
                ));
            }
        })
        .await;

        app_config
            .logger
            .info(format!("Internal client for token({}) disconnected", token));
    } else {
        app_config.logger.err(format!(
            "Not found token({}) in current connecting peers",
            token
        ));
    }

    Ok(())
}
