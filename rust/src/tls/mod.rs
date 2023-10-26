// If this file cause build-failed, checkout readme.md

use bytes::Buf;
use rustls_pemfile::{certs, read_one, Item};
use std::io::{self, ErrorKind};
use tokio_rustls::rustls::{Certificate, PrivateKey};

mod cert_verifier;
pub use cert_verifier::CustomServerCertVerifier;

pub fn load_certs(out: &Option<Vec<u8>>) -> Result<Vec<Certificate>, io::Error> {
    let bytes = include_bytes!("server.crt");
    let bytes = match &out {
        Some(bytes) => bytes.as_slice(),
        None => bytes,
    };
    certs(&mut bytes.reader())
        .map_err(|_| io::Error::new(ErrorKind::InvalidInput, "invalid cert"))
        .map(|mut certs| certs.drain(..).map(Certificate).collect())
}

pub fn load_keys(out: &Option<Vec<u8>>) -> Result<Vec<PrivateKey>, io::Error> {
    let bytes = include_bytes!("server.key");
    let bytes = match &out {
        Some(bytes) => bytes.as_slice(),
        None => bytes,
    };
    private_keys(&mut bytes.reader())
        .map_err(|_| io::Error::new(ErrorKind::InvalidInput, "invalid key"))
        .map(|mut keys| keys.drain(..).map(PrivateKey).collect())
}

fn private_keys(rd: &mut dyn io::BufRead) -> Result<Vec<Vec<u8>>, io::Error> {
    let mut keys = Vec::<Vec<u8>>::new();

    loop {
        match read_one(rd)? {
            None => return Ok(keys),
            Some(Item::PKCS8Key(key)) => keys.push(key),
            Some(Item::ECKey(key)) => keys.push(key),
            Some(Item::RSAKey(key)) => keys.push(key),
            _ => {}
        };
    }
}
