use tauri::command;

#[command]
pub async fn open_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open browser: {}", e))
}
