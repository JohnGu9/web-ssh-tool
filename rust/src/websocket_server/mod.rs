mod on_authenticate;
mod on_client;
mod on_request_authenticate;
mod shell;
use crate::common::AppContext;
use flate2::write::{GzDecoder, GzEncoder};
use flate2::Compression;
use hyper::{upgrade::Upgraded, Request};
use std::io::Write;
use std::{error::Error, net::SocketAddr};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;

pub async fn handle_request(
    context: AppContext,
    addr: &SocketAddr,
    req: Request<hyper::body::Incoming>,
    ws_stream: WebSocketStream<Upgraded>,
) -> Result<(), Box<dyn Error>> {
    let app_config = context.app_config.clone();
    match req.uri().path() {
        "/" | "/rest" | "/rest/" => {
            on_request_authenticate::handle_request(context, addr, req, ws_stream).await
        }
        "/client" => {
            let is_loopback = match addr {
                SocketAddr::V4(v4) => v4.ip().is_loopback(),
                SocketAddr::V6(v6) => v6.ip().is_loopback(),
            };
            if let (Some(query), true) = (req.uri().query(), is_loopback) {
                use url::form_urlencoded::parse;
                let mut peers = parse(query.as_bytes()).into_owned();
                if let Some((_, token)) = peers.find(|(key, _)| key.as_str() == "t") {
                    on_client::handle_request(context, ws_stream, token.as_str()).await?;
                    return Ok(());
                }
            }
            app_config
                .logger
                .err(format!("Unknown client ws connection ({})", req.uri()));
            Ok(())
        }
        _ => {
            app_config
                .logger
                .err(format!("Unknown ws connection ({})", req.uri()));
            Ok(())
        }
    }
}

pub fn internal_decompress(input: &[u8]) -> Result<String, Box<dyn Error>> {
    let mut res = vec![];
    let mut decoder = GzDecoder::new(&mut res);
    decoder.write_all(input)?;
    decoder.finish()?;
    let str = String::from_utf8(res)?;
    Ok(str)
}

fn internal_compress(str: &String) -> Result<Vec<u8>, Box<dyn Error>> {
    let mut res = vec![];
    let mut decoder = GzEncoder::new(&mut res, Compression::default());
    decoder.write_all(str.as_bytes())?;
    decoder.finish()?;
    Ok(res)
}

pub fn encode_value(value: serde_json::Value) -> Message {
    let str = value.to_string();
    match internal_compress(&str) {
        Ok(data) => Message::Binary(data),
        Err(_) => Message::Text(str),
    }
}
