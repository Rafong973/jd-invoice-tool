use tauri::command;
use std::fs;
use std::path::PathBuf;
use crate::utils::file::read_cookie_file;

#[command]
pub async fn download_invoice(url: String, filename: String) -> Result<String, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;

    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let res = client
        .get(&url)
        .header("Cookie", &cookie)
        .header("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let download_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let file_path = download_dir.join(&filename);

    fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
