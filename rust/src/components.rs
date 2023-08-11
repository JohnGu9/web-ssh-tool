use bytes::Bytes;
use futures::{channel::mpsc::Sender, SinkExt};
use http_body_util::StreamBody;
use hyper::{body::Frame, Response};
use tokio::io::{AsyncRead, AsyncReadExt};

pub type ResponseUnit = Result<Frame<Bytes>, Box<dyn std::error::Error + Send + Sync>>;
pub type ResponseType = Response<StreamBody<futures::channel::mpsc::Receiver<ResponseUnit>>>;

pub async fn async_read_to_sender(mut file: impl AsyncRead + Unpin, mut tx: Sender<ResponseUnit>) {
    let mut buf = [0_u8; 1024 * 4];
    loop {
        let read_count = file.read(&mut buf).await;
        match read_count {
            Ok(read_count) => {
                if read_count == 0 {
                    break;
                }
                let data = Frame::data(Bytes::from(buf[..read_count].to_vec()));
                if let Err(_) = tx.send(Ok(data)).await {
                    break;
                }
            }
            Err(e) => {
                let e: Box<dyn std::error::Error + Send + Sync> = Box::new(e);
                let _ = tx.send(Err(e)).await;
                break;
            }
        }
    }
}