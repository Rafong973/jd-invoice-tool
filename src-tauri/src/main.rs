#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod api;
mod utils;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::browser::open_browser,
            commands::cookie::save_cookie,
            commands::cookie::get_cookie,
            commands::cookie::delete_cookie,
            commands::invoice::fetch_invoices,
            commands::invoice::fetch_invoice_detail,
            commands::exchange::fetch_batch_orders,
            commands::exchange::check_merge,
            commands::download::download_invoice,
            commands::title::get_titles,
            commands::title::save_titles,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
