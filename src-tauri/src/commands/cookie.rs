use tauri::command;
use crate::utils::file::{read_cookie_file, write_cookie_file, delete_cookie_file};

#[command]
pub async fn save_cookie(cookie: String) -> Result<String, String> {
    write_cookie_file(&cookie)?;
    Ok("Cookie saved successfully".to_string())
}

#[command]
pub async fn get_cookie() -> Result<Option<String>, String> {
    read_cookie_file()
}

#[command]
pub async fn delete_cookie() -> Result<String, String> {
    delete_cookie_file()?;
    Ok("Cookie deleted successfully".to_string())
}
