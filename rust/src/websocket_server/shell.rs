use futures::channel::mpsc;
use futures::SinkExt;
use futures::{lock::Mutex, StreamExt};
use russh::{client::Handle, client::Msg, Channel, ChannelMsg};
use std::{collections::HashMap, sync::Arc};

use crate::common::websocket_peer::{Client, ClientConnection};

pub async fn handle_request(
    request: serde_json::Value,
    client_connection: &Arc<Mutex<ClientConnection>>,
    session: &Mutex<Handle<Client>>,
    shells: &Mutex<HashMap<String, mpsc::Sender<PollChannelData>>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut shells = shells.lock().await;

    match request {
        serde_json::Value::String(id) => {
            if let None = shells.get(&id) {
                let session = session.lock().await;
                let mut channel = session.channel_open_session().await?;
                drop(session);
                channel
                    .request_pty(true, "xterm", 83, 34, 512, 512, &[])
                    .await?;
                channel.request_shell(true).await?;
                let (tx, rx) = mpsc::channel(1);
                shells.insert(id.clone(), tx);
                drop(shells);
                tokio::spawn(poll_channel(channel, rx, client_connection.clone(), id));
            }
        }
        serde_json::Value::Object(mut request) => {
            if let Some(serde_json::Value::String(id)) = request.remove("id") {
                if let Some(_) = request.remove("close") {
                    if let Some(mut tx) = shells.remove(&id) {
                        tx.close().await?;
                    }
                } else {
                    if let Some(tx) = shells.get_mut(&id) {
                        if let Some(serde_json::Value::Object(resize)) = request.remove("resize") {
                            if let Some(resize) = parse_resize(resize) {
                                tx.send(PollChannelData::WindowChange(resize)).await?;
                            }
                        }
                        if let Some(data) = request.remove("data") {
                            match data {
                                serde_json::Value::String(data) => {
                                    tx.send(PollChannelData::String(data)).await?;
                                }
                                serde_json::Value::Array(data) => {
                                    let mut v = Vec::with_capacity(data.len());
                                    for i in data.iter() {
                                        if let Some(number) = i.as_u64() {
                                            v.push(number as u8);
                                        }
                                    }
                                    tx.send(PollChannelData::Vec(v)).await?;
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    }

    Ok(())
}

fn parse_resize(
    mut resize: serde_json::Map<String, serde_json::Value>,
) -> Option<(u32, u32, u32, u32)> {
    use serde_json::Value::Number;
    return match (
        resize.remove("cols"),
        resize.remove("rows"),
        resize.remove("height"),
        resize.remove("width"),
    ) {
        (Some(Number(cols)), Some(Number(rows)), Some(Number(height)), Some(Number(width))) => {
            match (
                cols.as_u64(),
                rows.as_u64(),
                height.as_u64(),
                width.as_u64(),
            ) {
                (Some(cols), Some(rows), Some(height), Some(width)) => {
                    Some((cols as u32, rows as u32, height as u32, width as u32))
                }
                _ => None,
            }
        }
        _ => None,
    };
}

pub enum PollChannelData {
    String(String),
    Vec(Vec<u8>),
    WindowChange((u32, u32, u32, u32)),
}

impl PollChannelData {
    async fn send_to_channel(self, channel: &mut Channel<Msg>) -> Result<(), russh::Error> {
        match self {
            PollChannelData::String(s) => {
                let reader = std::io::Cursor::new(s);
                channel.data(reader).await?;
            }
            PollChannelData::Vec(data) => {
                channel.data(&data[..]).await?;
            }
            PollChannelData::WindowChange((col_width, row_height, pix_width, pix_height)) => {
                channel
                    .window_change(col_width, row_height, pix_width, pix_height)
                    .await?;
            }
        };
        Ok(())
    }
}

async fn poll_channel(
    mut channel: Channel<Msg>,
    mut rx: mpsc::Receiver<PollChannelData>,
    client_connection: Arc<Mutex<ClientConnection>>,
    id: String,
) -> Result<(), russh::Error> {
    use serde_json::json;
    loop {
        tokio::select! {
            data = rx.next() => {
                if let Some(data) = data {
                    data.send_to_channel(&mut channel).await?;
                } else {
                    break;
                }
            },
            msg = channel.wait() => {
                if let Some(msg) = msg {
                    if let ChannelMsg::Data{data} = msg {
                        let data = data.to_vec();
                        let obj = json!({"shell":{"id": id, "data": data}});
                        let mut conn = client_connection.lock().await;
                        conn.forward_event(obj).await.map_err(|_|russh::Error::SendError)?;
                    }
                } else {
                    break;
                }
            }
        }
    }

    futures::join!(
        async {
            let mut conn = client_connection.lock().await;
            let _ = conn
                .forward_event(json!({"shell":{"id": id, "close": {}}}))
                .await;
        },
        async {
            if let Ok(_) = channel.eof().await {
                let _ = channel.close().await;
            }
        }
    );

    Ok(())
}
