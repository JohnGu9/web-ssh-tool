use futures::channel::{mpsc, oneshot};
use futures::lock::Mutex;
use std::sync::Weak;
pub type AuthenticateQueues = Weak<Mutex<mpsc::Sender<oneshot::Receiver<()>>>>;
