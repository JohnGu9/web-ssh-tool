use argh::FromArgs;
use chrono::prelude::*;
use std::path::PathBuf;

#[derive(Debug)]
pub struct AppConfig {
    pub listen_address: ListenAddress,
    pub certificate: Option<String>,
    pub private_key: Option<String>,
    pub logger: Logger,
    pub assets_path: Option<PathBuf>,
    pub local_ssh_port: String,
    pub client: Option<String>,
    pub bin: String,
}

impl AppConfig {
    pub fn new() -> Self {
        let opt: Options = argh::from_env();
        let listen_address = opt
            .listen_address
            .unwrap_or_else(|| "127.0.0.1:7200".to_string());
        let bin = std::env::current_exe()
            .unwrap()
            .to_str()
            .map(|s| s.to_string())
            .unwrap();

        AppConfig {
            listen_address: ListenAddress::new(listen_address),
            certificate: opt.certificate,
            private_key: opt.private_key,
            logger: match opt.disable_logger {
                true => Logger::None,
                false => match opt.logger {
                    Some(path) => Logger::File(std::sync::Mutex::new(0), path),
                    None => Logger::Stdio(std::sync::Mutex::new(0)),
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

#[derive(Debug)]
pub struct ListenAddress {
    pub domain: String,
    pub port: String,
    pub addr: String,
}

impl ListenAddress {
    fn new(addr: String) -> Self {
        let v: Vec<_> = addr.split(':').collect();
        return ListenAddress {
            domain: v[0].to_string(),
            port: v[1].to_string(),
            addr,
        };
    }
}

impl std::fmt::Display for ListenAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.domain, self.port)
    }
}

impl std::fmt::Display for AppConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        writeln!(f, "AppConfig: ")?;
        writeln!(f, "   logger:             {:?}", self.logger)?;
        writeln!(f, "   assets_path:        {:?}", self.assets_path)?;
        writeln!(f, "   bin:                {:?}", self.bin)?;
        writeln!(f, "   local_ssh_port:     {}", self.local_ssh_port)?;
        writeln!(f, "   certificate:        {:?}", self.certificate)?;
        writeln!(f, "   private_key:        {:?}", self.private_key)?;
        writeln!(f, "   listen_address:     {}", self.listen_address)?;
        Ok(())
    }
}

pub enum Logger {
    None,
    Stdio(std::sync::Mutex<i32>),
    File(std::sync::Mutex<i32>, String),
}

// @TODO: file logger implement

impl Logger {
    #[allow(dead_code)]
    pub fn info<T: std::fmt::Display>(&self, message: T) {
        match self {
            Logger::Stdio(m) => {
                let _ = m.lock();
                println!("{} [INFO]  {}", Utc::now().format("%+"), message)
            }
            Logger::File(m, _) => {
                let _ = m.lock();
                println!("{} [INFO]  {}", Utc::now().format("%+"), message)
            }
            Logger::None => {}
        }
    }
    #[allow(dead_code)]
    pub fn err<T: std::fmt::Display>(&self, message: T) {
        match self {
            Logger::Stdio(m) => {
                let _ = m.lock();
                eprintln!("{} [ERROR] {}", Utc::now().format("%+"), message)
            }
            Logger::File(m, _) => {
                let _ = m.lock();
                eprintln!("{} [ERROR] {}", Utc::now().format("%+"), message)
            }
            Logger::None => {}
        }
    }
}

impl std::fmt::Debug for Logger {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "None"),
            Self::Stdio(_) => write!(f, "Stdio"),
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

    /// use app log output (default: stdio, example: /tmp/my.log)
    #[argh(option)]
    logger: Option<String>,

    /// whether or not disable logger (default: false)
    #[argh(switch)]
    disable_logger: bool,

    /// use custom assets (default: bin's directory, example: /tmp/my_assets)
    #[argh(option, short = 'a')]
    assets_path: Option<String>,

    /// use custom ssh target (default: localhost:22, example: localhost:8080)
    #[argh(option)]
    local_ssh_port: Option<String>,

    /// internal use
    #[argh(option)]
    client: Option<String>,
}
