use super::components::{file_to_stream, http_to_master, ArgumentsError, BUF_SIZE};
use crate::common::{app_config::AppConfig, ResponseUnit};
use async_compat::CompatExt;
use async_zip::{base::write::ZipFileWriter, error::ZipError, Compression, ZipEntryBuilder};
use bytes::Bytes;
use futures::{
    channel::{mpsc, oneshot},
    join, AsyncWrite, Sink,
};
use http_body_util::{BodyExt, StreamBody};
use hyper::{body::Frame, header, http::HeaderValue, HeaderMap, Method, Request};
use serde_json::json;
use std::{
    convert::Infallible,
    path::{Path, PathBuf},
    pin::Pin,
    sync::Arc,
};
use walkdir::WalkDir;

pub async fn handle_request(
    app_config: &Arc<AppConfig>,
    token: &String,
    id: u64,
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let mut paths = vec![];
    if let serde_json::Value::Array(array) = argument {
        for path in array.iter() {
            if let serde_json::Value::String(path) = path {
                paths.push(path.clone());
            }
        }
    }
    if paths.len() == 0 {
        return Err(Box::new(ArgumentsError(Some(format!("no paths")))));
    }
    let (mut parts, _) = Request::new("").into_parts();
    let headers = &mut parts.headers;
    headers.append("id", HeaderValue::from_str(id.to_string().as_str())?);
    headers.append("peer", HeaderValue::from_str(token.as_str())?);
    headers.append(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );
    headers.append(header::CONNECTION, HeaderValue::from_static("close"));
    let (rx, on_end) = match paths.len() {
        1 => download_single(app_config, paths[0].to_owned(), headers).await?,
        _ => download_multi(app_config, paths, headers).await?,
    };

    let mut sender = http_to_master(app_config).await?;
    let body = StreamBody::new(rx);
    let mut req = Request::from_parts(parts, body);
    *req.uri_mut() = "/client".parse()?;
    *req.method_mut() = Method::PUT;
    let mut response = sender.send_request(req).await?;
    tokio::spawn(async move {
        let body = response.body_mut();
        while let Some(Ok(_)) = body.frame().await {}
    });
    tokio::spawn(async move {
        let _ = on_end.await;
        let _ = sender; // prevent socket from closing when sending files
    });
    Ok(json!(null))
}

pub async fn download_single(
    app_config: &Arc<AppConfig>,
    path: String,
    headers: &mut HeaderMap,
) -> Result<(mpsc::Receiver<ResponseUnit>, oneshot::Receiver<()>), ArgumentsError> {
    let p = Path::new(path.as_str()).to_path_buf();
    let p = if p.is_symlink() {
        if let Ok(buf) = tokio::fs::read_link(p).await {
            buf
        } else {
            Path::new(path.as_str()).to_path_buf()
        }
    } else {
        p
    };
    let file_name = match p.file_name() {
        Some(file_name) => match file_name.to_str() {
            Some(file_name) => Some(file_name),
            None => None,
        },
        None => None,
    };
    let (on_end_callback, on_end) = oneshot::channel();
    if let Some(file_name) = file_name {
        if p.is_file() {
            if let Ok(file) = tokio::fs::File::open(p.as_path()).await {
                if let Ok(disposition) = HeaderValue::from_str(
                    format!("attachment; filename=\"{}\";", file_name).as_str(),
                ) {
                    headers.append(header::CONTENT_DISPOSITION, disposition);
                }
                let meta = file.metadata().await;
                let (key, value) = if let Ok(meta) = meta {
                    if let Ok(size) = HeaderValue::from_str(meta.len().to_string().as_str()) {
                        (header::CONTENT_LENGTH, size)
                    } else {
                        (
                            header::TRANSFER_ENCODING,
                            HeaderValue::from_static("chunked"),
                        )
                    }
                } else {
                    (
                        header::TRANSFER_ENCODING,
                        HeaderValue::from_static("chunked"),
                    )
                };
                headers.append(key, value);
                return Ok((file_to_stream(file, on_end_callback), on_end));
            }
        } else if p.is_dir() {
            let (tx, rx) = mpsc::channel(BUF_SIZE);
            let p = p.to_path_buf();
            let app_config = app_config.clone();
            tokio::spawn(async move {
                if let Err(e) = zip_dir(p, tx, Compression::Deflate).await {
                    let error = format!("ZipError: {:?}", e);
                    app_config.logger.err(error);
                }
                let _ = on_end_callback.send(());
            });
            if let Ok(disposition) = HeaderValue::from_str(
                format!("attachment; filename=\"{}.zip\";", file_name).as_str(),
            ) {
                headers.append(header::CONTENT_DISPOSITION, disposition);
            }
            headers.append(
                header::TRANSFER_ENCODING,
                HeaderValue::from_static("chunked"),
            );
            return Ok((rx, on_end));
        }
    }
    return Err(ArgumentsError(None));
}

async fn zip_dir(
    dir_path: PathBuf,
    writer: mpsc::Sender<ResponseUnit>,
    method: async_zip::Compression,
) -> Result<(), ZipError> {
    let wrapper = SenderStream {
        sender: writer,
        transform: buf_to_frame,
    };
    let dir_path = dir_path.as_path();
    let mut zip = ZipFileWriter::new(wrapper);
    internal_zip_dir(&mut zip, method, dir_path, None).await?;
    zip.close().await?;
    Ok(())
}

async fn download_multi(
    app_config: &Arc<AppConfig>,
    paths: Vec<String>,
    headers: &mut HeaderMap,
) -> Result<(mpsc::Receiver<ResponseUnit>, oneshot::Receiver<()>), Infallible> {
    let (on_end_callback, on_end) = oneshot::channel();
    let (tx, rx) = mpsc::channel(BUF_SIZE);
    let app_config = app_config.clone();
    tokio::spawn(async move {
        if let Err(e) = zip_multi(paths, tx, Compression::Deflate).await {
            let error = format!("ZipError: {:?}", e);
            app_config.logger.err(error);
        }
        let _ = on_end_callback.send(());
    });
    if let Ok(disposition) =
        HeaderValue::from_str(format!("attachment; filename=\"bundle.zip\";").as_str())
    {
        headers.append(header::CONTENT_DISPOSITION, disposition);
    }
    headers.append(
        header::TRANSFER_ENCODING,
        HeaderValue::from_static("chunked"),
    );
    return Ok((rx, on_end));
}

async fn zip_multi(
    list: Vec<String>,
    writer: mpsc::Sender<ResponseUnit>,
    method: async_zip::Compression,
) -> Result<(), ZipError> {
    let wrapper = SenderStream {
        sender: writer,
        transform: buf_to_frame,
    };
    let mut zip = ZipFileWriter::new(wrapper);
    for path_str in list.iter() {
        let path = Path::new(path_str.as_str());
        if path.is_file() {
            match path.file_name() {
                Some(filename) => match filename.to_str() {
                    Some(filename) => {
                        internal_zip_single(&mut zip, method, filename.into(), path).await?;
                    }
                    None => {}
                },
                None => {}
            };
        } else if path.is_dir() {
            internal_zip_dir(&mut zip, method, path, Some(path_str)).await?;
        }
    }
    zip.close().await?;
    Result::Ok(())
}

async fn internal_zip_single<W: AsyncWrite + Unpin>(
    zip: &mut ZipFileWriter<W>,
    method: async_zip::Compression,
    filename: async_zip::ZipString,
    path: &Path,
) -> Result<(), ZipError> {
    let builder = ZipEntryBuilder::new(filename, method);
    if let (Ok(file), Ok(mut stream)) =
        join!(tokio::fs::File::open(path), zip.write_entry_stream(builder),)
    {
        futures::io::copy(file.compat(), &mut stream).await?;
        stream.close().await?;
    }
    Ok(())
}

async fn internal_zip_dir<W: AsyncWrite + Unpin>(
    zip: &mut ZipFileWriter<W>,
    method: async_zip::Compression,
    dir_path: &Path,
    prefix: Option<&String>,
) -> Result<(), ZipError> {
    let walk_dir = WalkDir::new(dir_path);
    for entry in walk_dir.into_iter() {
        if let Ok(entry) = entry {
            let path = entry.path();
            let name = path
                .strip_prefix(dir_path)
                .map_err(|_| ZipError::FeatureNotSupported("path strip prefix failed"))?;
            if let (Some(filename), true) = (name.to_str(), path.is_file()) {
                // Write file or directory explicitly
                // Some unzip tools unzip files with directory paths correctly, some do not!
                let filename = match prefix {
                    Some(prefix) => match Path::new(prefix.as_str()).join(filename).to_str() {
                        Some(filename) => filename.to_string(),
                        None => filename.to_string(),
                    },
                    None => filename.to_string(),
                };
                internal_zip_single(zip, method, filename.into(), path).await?;
            } else if path.is_dir() {
            }
        }
    }
    Ok(())
}

#[pin_project::pin_project]
struct SenderStream<T, F>
where
    F: Fn(&[u8]) -> T,
{
    transform: F,
    sender: mpsc::Sender<T>,
}

impl<T, F> SenderStream<T, F> where F: Fn(&[u8]) -> T {}

impl<T, F> futures::AsyncWrite for SenderStream<T, F>
where
    F: Fn(&[u8]) -> T,
{
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        match Pin::new(&mut self.sender).poll_ready(cx) {
            std::task::Poll::Ready(Ok(_)) => {
                let data = (self.transform)(buf);
                match Pin::new(&mut self.sender).start_send(data) {
                    Ok(_) => std::task::Poll::Ready(Ok(buf.len())),
                    Err(_) => std::task::Poll::Ready(Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        SenderStreamError::StartSend,
                    ))),
                }
            }
            std::task::Poll::Ready(Err(_)) => std::task::Poll::Ready(Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                SenderStreamError::PollReady,
            ))),
            std::task::Poll::Pending => std::task::Poll::Pending,
        }
    }

    fn poll_flush(
        mut self: Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        let sender = Pin::new(&mut self.sender);
        match sender.poll_flush(cx) {
            std::task::Poll::Ready(Ok(_)) => std::task::Poll::Ready(Ok(())),
            std::task::Poll::Ready(Err(_)) => std::task::Poll::Ready(Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                SenderStreamError::PollFlush,
            ))),
            std::task::Poll::Pending => std::task::Poll::Pending,
        }
    }

    fn poll_close(
        self: Pin<&mut Self>,
        _: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::task::Poll::Ready(Ok(()))
        // let this = self.project();
        // this.sender
        //     .poll_close_unpin(cx)
        //     .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    }
}

#[derive(Debug, Clone)]
enum SenderStreamError {
    PollReady,
    StartSend,
    PollFlush,
}

impl std::fmt::Display for SenderStreamError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SenderStreamError::{:?}", self)
    }
}
impl std::error::Error for SenderStreamError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        None
    }
}

fn buf_to_frame(buf: &[u8]) -> ResponseUnit {
    return Ok(Frame::data(Bytes::from(buf.to_vec())));
}
