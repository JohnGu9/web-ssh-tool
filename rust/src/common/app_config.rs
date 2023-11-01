use argh::FromArgs;
use chrono::prelude::*;
use futures::{channel::mpsc, lock::Mutex, SinkExt, StreamExt};
use std::{
    net::{SocketAddr, ToSocketAddrs},
    path::PathBuf,
};
use tokio::io::AsyncWriteExt;

#[derive(Debug)]
pub struct AppConfig {
    pub listen_address: SocketAddr,
    pub certificate: Option<String>,
    pub private_key: Option<String>,
    pub logger: Logger,
    pub local_ssh_port: String,
    pub bin: String,

    // internal use
    pub assets_path: Option<PathBuf>,
    pub client: Option<String>,
}

impl AppConfig {
    pub fn new() -> Self {
        let opt: Options = argh::from_env();
        let listen_address = opt
            .listen_address
            .unwrap_or_else(|| "localhost:7200".to_string())
            .to_socket_addrs()
            .expect("--listen-address argument format error")
            .as_slice()[0];
        let bin = std::env::current_exe()
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .expect("current operation system doesn't support (can't get bin file path)");

        AppConfig {
            listen_address,
            certificate: opt.certificate,
            private_key: opt.private_key,
            logger: match opt.disable_logger {
                true => Logger::None,
                false => match opt.logger {
                    None => Logger::Stdio,
                    Some(path) => {
                        let (tx, rx) = mpsc::channel::<String>(64);
                        tokio::spawn(run_file_logger(rx, path.clone()));
                        Logger::File(Mutex::new(tx), path)
                    }
                },
            },
            assets_path: match opt.assets_path {
                Some(p) => Some(PathBuf::from(p)),
                None => None,
            },
            local_ssh_port: match opt.local_ssh_port {
                Some(address) => address,
                None => "22".to_string(),
            },
            client: opt.client,
            bin,
        }
    }
}

async fn run_file_logger(mut rx: mpsc::Receiver<String>, path: String) {
    let mut option = tokio::fs::OpenOptions::new();
    option.create(true).write(true).append(true);
    let mut file = option.open(&path).await.expect("Failed to open log file. ");
    let mut has_lost_some_log = false;
    while let Some(message) = rx.next().await {
        if let Err(e) = file.write_all(message.as_bytes()).await {
            if !has_lost_some_log {
                eprintln!(
                    "Failed to write log to file ({:?}). Trying reopen log file. ",
                    e
                );
            }
            match option.open(&path).await {
                Ok(f) => file = f,
                Err(_) => {}
            }
            if let Err(e) = file.write_all(message.as_bytes()).await {
                if !has_lost_some_log {
                    eprintln!("Failed to reopen log file and write log to file ({:?}). Output log to stdio. ", e);
                }
                println!("{}", message);
                has_lost_some_log = true;
            }
        } else {
            if has_lost_some_log {
                if let Ok(_) = file
                    .write_all(format!(
                        "{} [ERROR] Some log messages have been lost. Please check out the lost messages in app stdio. \n",
                        Utc::now().format("%+")
                    ).as_bytes())
                    .await
                {
                    has_lost_some_log = false;
                }
            }
        }
    }
}

impl std::fmt::Display for AppConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        writeln!(f, "AppConfig: ")?;
        writeln!(f, "   listen_address:     {}", self.listen_address)?;
        writeln!(f, "   certificate:        {:?}", self.certificate)?;
        writeln!(f, "   private_key:        {:?}", self.private_key)?;
        writeln!(f, "   logger:             {:?}", self.logger)?;
        writeln!(f, "   local_ssh_port:     {}", self.local_ssh_port)?;
        writeln!(f, "   bin:                {:?}", self.bin)?;
        Ok(())
    }
}

pub enum Logger {
    None,
    Stdio,
    File(Mutex<mpsc::Sender<String>>, String),
}

// @TODO: file logger implement

impl Logger {
    #[allow(dead_code)]
    pub fn info<T: std::fmt::Display>(&self, message: T) {
        match self {
            Logger::Stdio => {
                println!("{} [INFO]  {}", Utc::now().format("%+"), message)
            }
            Logger::File(tx, _) => {
                futures::executor::block_on(async {
                    let _ = tx
                        .lock()
                        .await
                        .send(format!("{} [INFO]  {}\n", Utc::now().format("%+"), message))
                        .await;
                });
            }
            Logger::None => {}
        }
    }
    #[allow(dead_code)]
    pub fn err<T: std::fmt::Display>(&self, message: T) {
        match self {
            Logger::Stdio => {
                eprintln!("{} [ERROR] {}", Utc::now().format("%+"), message)
            }
            Logger::File(tx, _) => {
                futures::executor::block_on(async {
                    let _ = tx
                        .lock()
                        .await
                        .send(format!("{} [ERROR] {}\n", Utc::now().format("%+"), message))
                        .await;
                });
            }
            Logger::None => {}
        }
    }
}

impl std::fmt::Debug for Logger {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "None"),
            Self::Stdio => write!(f, "Stdio"),
            Self::File(_, path) => write!(f, "File({})", path),
        }
    }
}

#[derive(FromArgs)]
/// AppConfig
struct Options {
    /// server listen address (default: 127.0.0.1:7200, example: 0.0.0.0:8080)
    #[argh(option, short = 'l')]
    listen_address: Option<String>,

    /// use custom tls certificate path (example: pem/test.crt)
    #[argh(option, short = 'c')]
    certificate: Option<String>,

    /// use custom tls private key path (example: pem/test.key)
    #[argh(option, short = 'k')]
    private_key: Option<String>,

    /// use app log output, if this argument is set, stdio log output will be disable (default: stdio, example: /tmp/my.log)
    #[argh(option)]
    logger: Option<String>,

    /// whether or not disable logger, if disable is true, '--logger' argument become useless (default: false)
    #[argh(switch)]
    disable_logger: bool,

    /// use custom ssh port (default: 22, example: 8080)
    #[argh(option)]
    local_ssh_port: Option<String>,

    /// use custom static assets and don't set this argument until you know what it means (default: bin internal static assets, example: /tmp/my_assets)
    #[argh(option)]
    assets_path: Option<String>,

    /// internal use and don't set this argument until you know what it means
    #[argh(option)]
    client: Option<String>,
}
