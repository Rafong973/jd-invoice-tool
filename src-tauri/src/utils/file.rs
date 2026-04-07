use std::fs;
use std::path::PathBuf;

fn get_app_data_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_local_dir()
        .ok_or("Cannot find app data directory")?
        .join("jd-invoice-app");

    if !app_data.exists() {
        fs::create_dir_all(&app_data).map_err(|e| format!("Failed to create data dir: {}", e))?;
    }

    Ok(app_data)
}

fn get_cookie_file_path() -> Result<PathBuf, String> {
    Ok(get_app_data_dir()?.join("cookie.txt"))
}

fn get_titles_file_path() -> Result<PathBuf, String> {
    Ok(get_app_data_dir()?.join("titles.json"))
}

pub fn read_cookie_file() -> Result<Option<String>, String> {
    let path = get_cookie_file_path()?;
    if path.exists() {
        let content =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read cookie file: {}", e))?;
        Ok(Some(content.trim().to_string()))
    } else {
        Ok(None)
    }
}

pub fn write_cookie_file(cookie: &str) -> Result<(), String> {
    let path = get_cookie_file_path()?;
    fs::write(&path, cookie).map_err(|e| format!("Failed to write cookie file: {}", e))
}

pub fn delete_cookie_file() -> Result<(), String> {
    let path = get_cookie_file_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete cookie file: {}", e))?;
    }
    Ok(())
}

pub fn read_titles_file() -> Result<String, String> {
    let path = get_titles_file_path()?;
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read titles file: {}", e))
    } else {
        Ok("[]".to_string())
    }
}

pub fn write_titles_file(content: &str) -> Result<(), String> {
    let path = get_titles_file_path()?;
    fs::write(&path, content).map_err(|e| format!("Failed to write titles file: {}", e))
}
