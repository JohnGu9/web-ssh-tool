use chrono::{DateTime, Utc};
use futures::{
    channel::mpsc::{channel, Receiver, Sender},
    lock::Mutex,
    SinkExt, StreamExt,
};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::{json, Map};
use std::{
    collections::HashMap,
    fs::FileType,
    path::{Path, PathBuf},
    sync::Arc,
    time::SystemTime,
};

pub async fn handle_request(
    request: &serde_json::Value,
    event_channel: &Mutex<Sender<serde_json::Value>>,
    watchers: &Mutex<HashMap<String, Arc<Mutex<MyWatcher>>>>,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let mut watchers = watchers.lock().await;
    match request {
        serde_json::Value::String(request) => {
            if let None = watchers.get(request) {
                let (tx, mut rx) = channel::<serde_json::Value>(1);
                let mut event_channel = event_channel.lock().await.clone();
                tokio::spawn(async move {
                    while let Some(data) = rx.next().await {
                        if let Err(_) = event_channel.send(json!({ "watch": data })).await {
                            break;
                        }
                    }
                });
                let watcher = MyWatcher::new(
                    request.clone(),
                    tx,
                    std::env::current_dir().unwrap_or_else(|_| std::env::temp_dir()),
                )
                .await?;
                watchers.insert(request.clone(), watcher);
            }
        }
        serde_json::Value::Object(request) => {
            if let Some(serde_json::Value::String(id)) = request.get("id") {
                if let Some(_) = request.get("close") {
                    watchers.remove(id);
                } else if let Some(cd) = request.get("cd") {
                    if let Some(watcher) = watchers.get_mut(id) {
                        let watcher = watcher.clone();
                        drop(watchers);
                        match cd {
                            serde_json::Value::String(cd) => {
                                let path = PathBuf::from(cd);
                                watcher.lock().await.watch(path).await?;
                            }
                            serde_json::Value::Null => {
                                watcher
                                    .lock()
                                    .await
                                    .watch(
                                        std::env::current_dir()
                                            .unwrap_or_else(|_| std::env::temp_dir()),
                                    )
                                    .await?;
                            }
                            _ => {}
                        }
                    }
                } else if let Some(_) = request.get("cdToParent") {
                    if let Some(watcher) = watchers.get_mut(id) {
                        let watcher = watcher.clone();
                        drop(watchers);
                        let mut watcher = watcher.lock().await;
                        let p = if let Some(p) = watcher.current_path.as_path().parent() {
                            Some(p.to_path_buf())
                        } else {
                            None
                        };
                        if let Some(p) = p {
                            watcher.watch(p).await?;
                        } else {
                            watcher.handle_on_change().await?;
                        }
                    }
                }
            }
        }
        _ => {}
    }
    Ok(serde_json::Value::Null)
}

pub struct MyWatcher {
    id: String,
    watcher: RecommendedWatcher,
    current_path: PathBuf,
    event_channel: Sender<serde_json::Value>,
}

impl MyWatcher {
    async fn new(
        id: String,
        event_channel: Sender<serde_json::Value>,
        path: PathBuf,
    ) -> notify::Result<Arc<Mutex<MyWatcher>>> {
        let (mut watcher, rx) = async_watcher()?;
        let res = watcher.watch(&path, RecursiveMode::NonRecursive);
        let mut this = Self {
            id,
            watcher,
            event_channel,
            current_path: path,
        };
        let _ = this.handle_watch_result(res).await;
        let this = Arc::new(Mutex::new(this));
        tokio::spawn(poll_event(rx, this.clone()));
        Ok(this)
    }

    async fn watch(&mut self, path: PathBuf) -> Result<(), futures::channel::mpsc::SendError> {
        self.current_path = path;
        let res = self
            .watcher
            .watch(&self.current_path, RecursiveMode::NonRecursive);
        self.handle_watch_result(res).await
    }

    async fn handle_watch_result(
        &mut self,
        res: Result<(), notify::Error>,
    ) -> Result<(), futures::channel::mpsc::SendError> {
        match res {
            Ok(_) => self.handle_on_change().await,
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_on_change(&mut self) -> Result<(), futures::channel::mpsc::SendError> {
        match tokio::fs::metadata(self.current_path.as_path()).await {
            Ok(data) => {
                if data.is_dir() {
                    self.handle_dir_on_change().await
                } else if data.is_file() {
                    self.handle_file_on_change().await
                } else if data.is_symlink() {
                    self.handle_link_on_change().await
                } else {
                    self.send_error(MyWatcherError::UnsupportedMultiNestSymlink)
                        .await
                }
            }
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_dir_on_change(&mut self) -> Result<(), futures::channel::mpsc::SendError> {
        match tokio::fs::read_dir(self.current_path.as_path()).await {
            Ok(mut r) => {
                let mut m = Map::new();
                while let Ok(Some(entry)) = r.next_entry().await {
                    if let Some(file_name) = entry.file_name().to_str() {
                        let path = entry.path();
                        let meta_data = match entry.metadata().await {
                            Ok(meta) => {
                                let c = match meta.created() {
                                    Ok(data) => Some(system_time_to_string(data)),
                                    Err(_) => None,
                                };
                                let a = match meta.accessed() {
                                    Ok(data) => Some(system_time_to_string(data)),
                                    Err(_) => None,
                                };
                                let m = match meta.modified() {
                                    Ok(data) => Some(system_time_to_string(data)),
                                    Err(_) => None,
                                };

                                let real_path = if meta.is_symlink() {
                                    match tokio::fs::read_link(path.clone()).await {
                                        Ok(real_path) => match real_path.to_str() {
                                            Some(s) => Some(s.to_string()),
                                            None => None,
                                        },
                                        Err(_) => None,
                                    }
                                } else {
                                    None
                                };

                                let real_type = match &real_path {
                                    Some(real_path) => {
                                        let path = Path::new(real_path.as_str());
                                        let real_meta = tokio::fs::metadata(path).await;
                                        match real_meta {
                                            Ok(real_meta) => {
                                                file_type_to_string(real_meta.file_type())
                                            }
                                            Err(_) => None,
                                        }
                                    }
                                    None => None,
                                };

                                Some((
                                    meta.len(),
                                    file_type_to_string(meta.file_type()),
                                    c,
                                    a,
                                    m,
                                    real_path,
                                    real_type,
                                ))
                            }
                            Err(_) => None,
                        };
                        if let Some((
                            size,
                            file_type,
                            created,
                            accessed,
                            modified,
                            real_path,
                            real_type,
                        )) = meta_data
                        {
                            let basename = match path.file_name() {
                                Some(os_str) => match os_str.to_str() {
                                    Some(str) => Some(str),
                                    None => None,
                                },
                                None => None,
                            };
                            let path = path.to_str();
                            m.insert(
                                file_name.to_string(),
                                json!({
                                    "path":path,
                                    "basename":basename,
                                    "realPath":real_path,
                                    "type":file_type,
                                    "realType": real_type,
                                    "size":size,
                                    "createdTime":created,
                                    "accessedTime":accessed,
                                    "modifiedTime":modified
                                }),
                            );
                        }
                    }
                }
                let real_path = path_buf_to_real_path(&self.current_path);
                let basename = match self.current_path.file_name() {
                    Some(os_str) => match os_str.to_str() {
                        Some(str) => Some(str),
                        None => None,
                    },
                    None => None,
                };
                let file_type = "directory";
                self.event_channel
                    .send(json!({
                        "id":self.id,
                        "path":self.current_path.to_str(),
                        "basename":basename,
                        "realPath":real_path,
                        "type":file_type,
                        "entries":m
                    }))
                    .await
            }
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_file_on_change(&mut self) -> Result<(), futures::channel::mpsc::SendError> {
        match tokio::fs::read(self.current_path.as_path()).await {
            Ok(_) => {
                let real_path = path_buf_to_real_path(&self.current_path);
                self.event_channel
                .send(json!({"id":self.id, "path":self.current_path.to_str(), "realPath":real_path}))
                .await
            }
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_link_on_change(&mut self) -> Result<(), futures::channel::mpsc::SendError> {
        match tokio::fs::read_link(self.current_path.as_path()).await {
            Ok(real_path) => match tokio::fs::metadata(real_path.as_path()).await {
                Ok(data) => {
                    if data.is_dir() {
                        self.handle_dir_on_change().await
                    } else if data.is_file() {
                        self.handle_file_on_change().await
                    } else {
                        self.send_error(MyWatcherError::UnsupportedFileType).await
                    }
                }
                Err(err) => self.send_error(err).await,
            },
            Err(err) => self.send_error(err).await,
        }
    }

    async fn send_error(
        &mut self,
        err: impl std::error::Error,
    ) -> Result<(), futures::channel::mpsc::SendError> {
        let error_message = format!("{}", err);
        self.event_channel
            .send(json!({"id":self.id, "path":self.current_path.to_str(), "error":error_message}))
            .await
    }
}

impl Drop for MyWatcher {
    fn drop(&mut self) {
        let _ = self.watcher.unwatch(&self.current_path);
        let id = self.id.to_owned();
        let mut event_channel = self.event_channel.to_owned();
        tokio::spawn(async move {
            let _ = event_channel.send(json!({"id":id, "close":{}})).await;
        });
    }
}

fn path_buf_to_real_path(path_buf: &PathBuf) -> Option<String> {
    match std::fs::canonicalize(path_buf) {
        Ok(p) => match p.to_str() {
            Some(s) => Some(s.to_string()),
            None => None,
        },
        Err(_) => None,
    }
}

fn file_type_to_string(file_type: FileType) -> Option<&'static str> {
    if file_type.is_dir() {
        Some("directory")
    } else if file_type.is_file() {
        Some("file")
    } else if file_type.is_symlink() {
        Some("symbolic link")
    } else {
        None
    }
}

#[derive(Debug)]
enum MyWatcherError {
    UnsupportedFileType,
    UnsupportedMultiNestSymlink,
}

impl std::fmt::Display for MyWatcherError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for MyWatcherError {}

fn async_watcher() -> notify::Result<(RecommendedWatcher, Receiver<notify::Result<Event>>)> {
    let (mut tx, rx) = channel(1);

    // Automatically select the best implementation for your platform.
    // You can also access each implementation directly e.g. INotifyWatcher.
    let config = Config::default();
    let watcher = RecommendedWatcher::new(
        move |res| {
            futures::executor::block_on(async {
                let _ = tx.send(res).await;
            })
        },
        config,
    )?;

    Ok((watcher, rx))
}

async fn poll_event(mut rx: Receiver<notify::Result<Event>>, watcher: Arc<Mutex<MyWatcher>>) {
    while let Some(res) = rx.next().await {
        let mut watcher = watcher.lock().await;
        match res {
            Ok(_) => watcher.handle_on_change().await.unwrap_or_default(),
            Err(e) => watcher.send_error(e).await.unwrap_or_default(),
        }
    }
}

fn system_time_to_string(time: SystemTime) -> String {
    let dt: DateTime<Utc> = time.into();
    format!("{}", dt.format("%d-%b-%Y %H:%M:%S %P %z"))
}