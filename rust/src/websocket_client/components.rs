use crate::common::{
    app_config::AppConfig,
    {forward_async_read_to_sender, ResponseUnit},
};
use crate::tls::CustomServerCertVerifier;
use futures::channel::{mpsc, oneshot};
use hyper::client::conn::http1::SendRequest;
use std::{path::PathBuf, sync::Arc};
use tokio_rustls::rustls::ServerName;

#[derive(Debug, Clone)]
pub struct ArgumentsError(pub Option<String>);

impl std::fmt::Display for ArgumentsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.0 {
            Some(str) => write!(f, "ArgumentsError: {}", str),
            None => write!(f, "ArgumentsError"),
        }
    }
}
impl std::error::Error for ArgumentsError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}

pub fn path_like_to_path(path_like: &Vec<serde_json::Value>) -> Option<PathBuf> {
    let mut buf = PathBuf::new();
    for clip in path_like.iter() {
        if let serde_json::Value::String(str) = clip {
            buf.push(str.as_str())
        } else {
            return None;
        }
    }
    return Some(buf);
}

pub fn file_to_stream(
    file: tokio::fs::File,
    on_end_callback: oneshot::Sender<()>,
) -> mpsc::Receiver<ResponseUnit> {
    let (tx, rx) = mpsc::channel(1);
    tokio::spawn(async move {
        forward_async_read_to_sender(file, tx).await;
        let _ = on_end_callback.send(());
    });
    return rx;
}

use http_body_util::StreamBody;
pub async fn http_to_master(
    app_config: &Arc<AppConfig>,
) -> Result<SendRequest<StreamBody<mpsc::Receiver<ResponseUnit>>>, Box<dyn std::error::Error>> {
    use std::net::{IpAddr, Ipv4Addr};
    use tokio::net::TcpStream;
    use tokio_rustls::{rustls::ClientConfig, TlsConnector};
    let addr = format!("localhost:{}", app_config.listen_address.port()); // use domain is more robust than SocketAddr
    let stream = TcpStream::connect(addr).await?;
    let config = ClientConfig::builder()
        .with_safe_defaults()
        .with_custom_certificate_verifier(Arc::new(CustomServerCertVerifier {}))
        .with_no_client_auth();
    let connector = TlsConnector::from(Arc::new(config));
    let server_name = ServerName::IpAddress(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    let stream = connector.connect(server_name, stream).await?;
    use hyper::client::conn::http1::handshake;
    let (sender, conn) = handshake(stream).await?;
    tokio::spawn(conn);
    Ok(sender)
}

pub const BUF_SIZE: usize = 8;
