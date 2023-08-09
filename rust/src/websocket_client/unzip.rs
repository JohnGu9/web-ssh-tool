use super::components::{path_like_to_path, ArgumentsError};
use flate2::write::GzDecoder;
use serde_json::json;
use std::{error::Error, path::Path};

pub async fn handle_request(argument: &serde_json::Value) -> Result<serde_json::Value, Box<dyn Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 2 {
            if let (serde_json::Value::String(src), serde_json::Value::Array(path_like)) =
                (&array[0], &array[1])
            {
                match path_like_to_path(path_like) {
                    Some(dest) => {
                        let src = Path::new(src.as_str());
                        internal_unzip(src, dest.as_path())?;
                        return Ok(json!(null));
                    }
                    None => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(Some(format!("{:?}", argument)))));
}

fn internal_unzip(src: &Path, dest: &Path) -> Result<(), Box<dyn Error>> {
    let mut src = std::fs::File::open(src)?;
    let dest = std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .open(dest)?;
    let mut decoder = GzDecoder::new(dest);
    std::io::copy(&mut src, &mut decoder)?;
    decoder.finish()?;
    Ok(())
}
