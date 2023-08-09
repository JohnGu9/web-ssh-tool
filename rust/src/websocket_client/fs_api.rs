use serde_json::json;
use tokio::{fs::OpenOptions, io::AsyncWriteExt};

use super::components::{path_like_to_path, ArgumentsError};

pub async fn fs_access(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 1 {
            if let serde_json::Value::Array(path_like) = &array[0] {
                match path_like_to_path(path_like) {
                    Some(path) => {
                        if path.is_file() {
                            let _ = std::fs::File::options().read(true).open(path)?;
                            return Ok(json!(true));
                        } else if path.is_dir() {
                            let _ = tokio::fs::read_dir(path).await?;
                            return Ok(json!(true));
                        }
                    }
                    None => {}
                }
                return Err(Box::new(ArgumentsError(Some("Unknown path".to_string()))));
            }
        }
    }
    return Err(Box::new(ArgumentsError(Some(format!("{:?}", argument)))));
}

pub async fn fs_unlink(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 1 {
            if let serde_json::Value::Array(path_like) = &array[0] {
                match path_like_to_path(path_like) {
                    Some(path) => {
                        tokio::fs::remove_file(path).await?;
                        return Ok(serde_json::Value::Null);
                    }
                    None => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}

pub async fn fs_rm(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 1 {
            if let serde_json::Value::Array(path_like) = &array[0] {
                match path_like_to_path(path_like) {
                    Some(path) => {
                        tokio::fs::remove_dir_all(path).await?;
                        return Ok(serde_json::Value::Null);
                    }
                    None => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}

pub async fn fs_exists(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 1 {
            if let serde_json::Value::Array(path_like) = &array[0] {
                match path_like_to_path(path_like) {
                    Some(path) => return Ok(serde_json::Value::Bool(path.exists())),
                    None => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}

pub async fn fs_rename(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 2 {
            if let (
                serde_json::Value::Array(src_path_like),
                serde_json::Value::Array(dest_path_like),
            ) = (&array[0], &array[1])
            {
                match (
                    path_like_to_path(src_path_like),
                    path_like_to_path(dest_path_like),
                ) {
                    (Some(src), Some(dest)) => {
                        tokio::fs::rename(src, dest).await?;
                        return Ok(serde_json::Value::Null);
                    }
                    _ => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}

pub async fn fs_mkdir(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 1 {
            if let serde_json::Value::Array(path_like) = &array[0] {
                match path_like_to_path(path_like) {
                    Some(path) => {
                        tokio::fs::create_dir_all(path).await?;
                        return Ok(serde_json::Value::Null);
                    }
                    None => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}

pub async fn fs_cp(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 2 {
            if let (
                serde_json::Value::Array(src_path_like),
                serde_json::Value::Array(dest_path_like),
            ) = (&array[0], &array[1])
            {
                match (
                    path_like_to_path(src_path_like),
                    path_like_to_path(dest_path_like),
                ) {
                    (Some(src), Some(dest)) => {
                        tokio::fs::copy(src, dest).await?;
                        return Ok(serde_json::Value::Null);
                    }
                    _ => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}

pub async fn fs_write_file(
    argument: &serde_json::Value,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    if let serde_json::Value::Array(array) = argument {
        if array.len() == 2 {
            if let (serde_json::Value::Array(path_like), serde_json::Value::String(content)) =
                (&array[0], &array[1])
            {
                match path_like_to_path(path_like) {
                    Some(path) => {
                        let mut file = OpenOptions::new()
                            .write(true)
                            .create_new(true)
                            .open(path)
                            .await?;
                        file.write_all(content.as_bytes()).await?;
                        file.sync_all().await?;
                        return Ok(serde_json::Value::Null);
                    }
                    None => {}
                }
            }
        }
    }
    return Err(Box::new(ArgumentsError(None)));
}
