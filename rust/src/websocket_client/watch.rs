use chrono::{DateTime, Utc};
use futures::{
    channel::{mpsc, oneshot},
    lock::Mutex,
    FutureExt, SinkExt, StreamExt,
};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::{json, Map};
use std::{
    collections::HashMap,
    fs::Metadata,
    path::{Path, PathBuf},
    sync::Arc,
    time::SystemTime,
};

pub async fn handle_request(
    request: &serde_json::Value,
    event_channel: &Mutex<mpsc::Sender<serde_json::Value>>,
    watchers: &Mutex<HashMap<String, Arc<Mutex<MyWatcher>>>>,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let mut watchers = watchers.lock().await;
    match request {
        serde_json::Value::String(request) => {
            if let None = watchers.get(request) {
                let (tx, mut rx) = mpsc::channel::<serde_json::Value>(1);
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
                    if let Some(watcher) = watchers.remove(id) {
                        let watcher = watcher.clone();
                        drop(watchers);
                        let mut watcher = watcher.lock().await;
                        watcher.close().await;
                    }
                } else if let Some(cd) = request.get("cd") {
                    if let Some(watcher) = watchers.get_mut(id) {
                        let watcher = watcher.clone();
                        drop(watchers);
                        let mut watcher = watcher.lock().await;
                        match cd {
                            serde_json::Value::String(cd) => {
                                let path = PathBuf::from(cd);
                                watcher.watch(path).await?;
                            }
                            serde_json::Value::Null => {
                                watcher
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
    event_channel: mpsc::Sender<serde_json::Value>,
    on_close: Option<oneshot::Sender<()>>,
}

impl MyWatcher {
    async fn new(
        id: String,
        event_channel: mpsc::Sender<serde_json::Value>,
        path: PathBuf,
    ) -> notify::Result<Arc<Mutex<MyWatcher>>> {
        let (tx, on_close) = oneshot::channel();
        let (mut watcher, rx) = async_watcher()?;
        let res = watcher.watch(&path, RecursiveMode::NonRecursive);
        let mut this = Self {
            id,
            watcher,
            event_channel,
            current_path: path,
            on_close: Some(tx),
        };
        let _ = this.handle_watch_result(res).await;
        let this = Arc::new(Mutex::new(this));
        tokio::spawn(MyWatcher::poll_event(rx, this.clone(), on_close));
        Ok(this)
    }

    async fn poll_event(
        mut rx: mpsc::Receiver<notify::Result<Event>>,
        watcher: Arc<Mutex<MyWatcher>>,
        on_close: oneshot::Receiver<()>,
    ) {
        let on_close = on_close.shared();
        loop {
            let on_close = on_close.clone();
            tokio::select! {
                _ = on_close => {
                    break;
                }
                res = rx.next() => {
                    let mut watcher = watcher.lock().await;
                    if let Some(res) = res {
                        let err =  match res {
                            Ok(_) => watcher.handle_on_change().await,
                            Err(e) => watcher.send_error(e).await,
                        };
                        if let Err(_) = err {
                            break;
                        } 
                    } else {
                        break;
                    }
                }
            }
        }
    }

    async fn watch(&mut self, path: PathBuf) -> Result<(), mpsc::SendError> {
        let _ = self.watcher.unwatch(&self.current_path);
        self.current_path = path;
        let res = self
            .watcher
            .watch(&self.current_path, RecursiveMode::NonRecursive);
        self.handle_watch_result(res).await
    }

    async fn handle_watch_result(
        &mut self,
        res: Result<(), notify::Error>,
    ) -> Result<(), mpsc::SendError> {
        match res {
            Ok(_) => self.handle_on_change().await,
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_on_change(&mut self) -> Result<(), mpsc::SendError> {
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

    async fn handle_dir_on_change(&mut self) -> Result<(), mpsc::SendError> {
        match tokio::fs::read_dir(self.current_path.as_path()).await {
            Ok(mut r) => {
                let mut m = Map::new();
                while let Ok(Some(entry)) = r.next_entry().await {
                    if let Some(file_name) = entry.file_name().to_str() {
                        let path = entry.path();
                        if let Ok(object_json) =
                            object_to_json(Some(file_name), path.as_path(), None, false).await
                        {
                            m.insert(file_name.to_string(), object_json);
                        }
                    }
                }
                let path = self.current_path.as_path();
                let basename = match path.file_name() {
                    Some(os_str) => os_str.to_str(),
                    None => None,
                };
                let dir_json = object_to_json(basename, path, Some(m), true).await;
                match dir_json {
                    Ok(dir_json) => self.send_json(dir_json).await,
                    Err(err) => self.send_error(err).await,
                }
            }
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_file_on_change(&mut self) -> Result<(), mpsc::SendError> {
        let path = self.current_path.as_path();
        let basename = match path.file_name() {
            Some(os_str) => match os_str.to_str() {
                Some(str) => Some(str),
                None => None,
            },
            None => None,
        };
        match object_to_json(basename, path, None, true).await {
            Ok(file_json) => self.send_json(file_json).await,
            Err(err) => self.send_error(err).await,
        }
    }

    async fn handle_link_on_change(&mut self) -> Result<(), mpsc::SendError> {
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

    async fn send_json(&mut self, data: serde_json::Value) -> Result<(), mpsc::SendError> {
        self.event_channel
            .send(json!({
                "id":self.id,
                "data":data,
            }))
            .await
    }

    async fn send_error(&mut self, err: impl std::error::Error) -> Result<(), mpsc::SendError> {
        let error_message = format!("{}", err);
        self.event_channel
            .send(json!({
                "id":self.id,
                "data":{
                    "path":self.current_path.to_str(),
                    "error":error_message,
                },
            }))
            .await
    }

    async fn close(&mut self) {
        let _ = self.watcher.unwatch(&self.current_path);
        if let Some(on_close) = self.on_close.take() {
            let _ = on_close.send(());
        }
        let _ = self
            .event_channel
            .send(json!({"id":self.id, "data":{"close":{}}}))
            .await;
    }
}

fn file_type_to_string(meta: &Metadata) -> Option<&'static str> {
    if meta.is_symlink() {
        Some("symbolic link")
    } else if meta.is_dir() {
        Some("directory")
    } else if meta.is_file() {
        Some("file")
    } else {
        None
    }
}

async fn object_to_json(
    file_name: Option<&str>,
    path: &Path,
    entries: Option<Map<String, serde_json::Value>>,
    include_parent: bool,
) -> std::io::Result<serde_json::Value> {
    let meta = tokio::fs::metadata(path).await?;
    let size = meta.len();
    let file_type = file_type_to_string(&meta);

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
                Ok(real_meta) => file_type_to_string(&real_meta),
                Err(_) => None,
            }
        }
        None => None,
    };
    let parent = match include_parent {
        true => match path.parent() {
            Some(parent) => parent.to_str(),
            None => None,
        },
        false => None,
    };

    let created = match meta.created() {
        Ok(data) => Some(system_time_to_string(data)),
        Err(_) => None,
    };
    let accessed = match meta.accessed() {
        Ok(data) => Some(system_time_to_string(data)),
        Err(_) => None,
    };
    let modified = match meta.modified() {
        Ok(data) => Some(system_time_to_string(data)),
        Err(_) => None,
    };

    let path = path.to_str();
    let mut m = Map::new();

    if let Some(file_name) = file_name {
        m.insert("basename".into(), json!(file_name));
    }
    if let Some(path) = path {
        m.insert("path".into(), json!(path));
    }
    if let Some(file_type) = file_type {
        m.insert("type".into(), json!(file_type));
    }
    if let Some(real_path) = real_path {
        m.insert("realPath".into(), json!(real_path));
    }
    if let Some(real_type) = real_type {
        m.insert("realType".into(), json!(real_type));
    }
    if let Some(created) = created {
        m.insert("createdTime".into(), json!(created));
    }
    if let Some(accessed) = accessed {
        m.insert("accessedTime".into(), json!(accessed));
    }
    if let Some(modified) = modified {
        m.insert("modifiedTime".into(), json!(modified));
    }
    if let Some(parent) = parent {
        m.insert("parent".into(), json!(parent));
    }
    if let Some(entries) = entries {
        m.insert("entries".into(), json!(entries));
    }
    m.insert("size".into(), json!(size));

    Ok(json!(m))
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

fn async_watcher() -> notify::Result<(RecommendedWatcher, mpsc::Receiver<notify::Result<Event>>)> {
    let (mut tx, rx) = mpsc::channel(1);

    // Automatically select the best implementation for your platform.
    // You can also access each implementation directly e.g. INotifyWatcher.
    let config = Config::default().with_compare_contents(true);
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

fn system_time_to_string(time: SystemTime) -> String {
    let dt: DateTime<Utc> = time.into();
    format!("{}", dt.format("%d-%b-%Y %H:%M:%S %P %z"))
}
