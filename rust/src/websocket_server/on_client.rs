use crate::{app_config::AppConfig, connection_peer::WebSocketPeer};
use futures::{lock::Mutex, StreamExt};
use hyper::upgrade::Upgraded;
use std::{collections::HashMap, error::Error, sync::Arc};
use tokio_tungstenite::{tungstenite::Message, WebSocketStream};

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    peer_map: &Arc<Mutex<HashMap<String, WebSocketPeer>>>,
    ws_stream: WebSocketStream<Upgraded>,
    token: &str,
) -> Result<(), Box<dyn Error>> {
    let map = peer_map.lock().await;
    if let Some(peer) = map.get(token) {
        app_config
            .logger
            .info(format!("Internal client for token({}) connected", token));

        let (write, read) = ws_stream.split();
        let client_connection = peer.client_connection.clone();
        drop(map);

        {
            let mut lk = client_connection.lock().await;
            lk.set_internal_client_stream(write);
        }

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

        {
            let mut lk = client_connection.lock().await;
            lk.clear_internal_client_stream();
        }

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
