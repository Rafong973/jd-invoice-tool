use tauri::command;
use serde::{Deserialize, Serialize};
use crate::utils::file::{read_titles_file, write_titles_file};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvoiceTitle {
    pub id: String,
    #[serde(rename = "titleType")]
    pub title_type: String,
    #[serde(rename = "titleName")]
    pub title_name: String,
    pub email: String,
    #[serde(rename = "taxNo")]
    pub tax_no: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

#[command]
pub async fn get_titles() -> Result<Vec<InvoiceTitle>, String> {
    let content = read_titles_file()?;
    let titles: Vec<InvoiceTitle> = serde_json::from_str(&content).unwrap_or_default();
    Ok(titles)
}

#[command]
pub async fn save_titles(titles_json: String) -> Result<String, String> {
    write_titles_file(&titles_json)?;
    Ok("Titles saved successfully".to_string())
}
