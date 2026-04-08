use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,WebviewWindow };
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static LOGIN_SUCCESS: AtomicBool = AtomicBool::new(false);

pub fn set_login_success() {
    LOGIN_SUCCESS.store(true, Ordering::SeqCst);
}

pub fn get_login_success() -> bool {
    LOGIN_SUCCESS.load(Ordering::SeqCst)
}

pub fn reset_login_success() {
    LOGIN_SUCCESS.store(false, Ordering::SeqCst);
}


#[tauri::command]
pub async fn open_login_window_clean(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("login-clean") {
        window.close().map_err(|e| e.to_string())?;
    }
    
    reset_login_success();
    
    let url = "https://plogin.m.jd.com/login/login?appid=300&returnurl=https%3A%2F%2Finvoice-m.jd.com%2F%23%2ForderList";

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    
    let data_dir = dirs::data_local_dir()
        .map(|p| p.join(format!("jd-invoice-login-{}", timestamp)))
        .ok_or("无法获取数据目录")?;

    let window = WebviewWindowBuilder::new(
        &app,
        "login-clean",
        WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    )
    .title("京东登录")
    .inner_size(480.0, 640.0)
    .resizable(true)
    .center()
    .data_directory(data_dir)
    .build()
    .map_err(|e| format!("Failed to create login window: {}", e))?;
    
    // 页面加载后执行JavaScript清除Cookie
    clear_cookies_via_js(window.clone());

    Ok(())
}

fn clear_cookies_via_js(window: WebviewWindow) {
    // 等待页面加载完成后执行
    let _ = window.eval(
        r#"
        // 页面加载后清除京东相关Cookie
        window.addEventListener('load', function() {
            console.log('Clearing JD cookies...');
            
            // 京东相关域名
            const jdDomains = ['.jd.com', '.jingxi.com', '.jd.hk'];
            const cookieNames = ['pt_key', 'pt_pin', 'unpl'];
            
            jdDomains.forEach(domain => {
                cookieNames.forEach(name => {
                    // 清除Cookie
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + domain;
                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                });
            });
            
            // 清除localStorage和sessionStorage
            localStorage.clear();
            sessionStorage.clear();
            
            // 重新加载页面以确保使用新的会话
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
        "#,
    );
}

#[tauri::command]
pub async fn close_login_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("login") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn close_login_window_clean(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("login-clean") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn is_login_window_open(app: AppHandle) -> bool {
    app.get_webview_window("login").is_some()
}

#[tauri::command]
pub async fn is_login_window_clean_open(app: AppHandle) -> bool {
    app.get_webview_window("login-clean").is_some()
}

#[tauri::command]
pub async fn has_login_succeeded() -> bool {
    get_login_success()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CookieInfo {
    pub name: String,
    pub value: String,
}

#[tauri::command]
pub async fn clear_login_window_cookies(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("login-clean") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_login_window_cache(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("login-clean") {
        window.close().map_err(|e| e.to_string())?;
    }
    
    let data_dir = dirs::data_local_dir()
        .map(|p| {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            p.join(format!("jd-invoice-login-{}", timestamp))
        })
        .ok_or("无法获取数据目录")?;
    
    if data_dir.exists() {
        std::fs::remove_dir_all(&data_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn extract_cookies(app: AppHandle) -> Result<String, String> {
    extract_cookies_from_window(&app, "login")
}

#[tauri::command]
pub async fn extract_cookies_clean(app: AppHandle) -> Result<String, String> {
    extract_cookies_from_window(&app, "login-clean")
}

fn extract_cookies_from_window(app: &AppHandle, label: &str) -> Result<String, String> {
    let webview = app.get_webview_window(label)
        .ok_or(format!("登录窗口未找到，请先点击「打开京东登录」"))?;

    let cookies = webview.cookies()
        .map_err(|e| format!("获取Cookie失败: {}", e))?;

    log::info!("Total cookies found: {}", cookies.len());
    
    for c in &cookies {
        log::info!("Cookie: {} = {} (domain: {:?})", c.name(), c.value(), c.domain());
    }
    
    let jd_cookies: Vec<CookieInfo> = cookies
        .into_iter()
        .filter(|c| {
            let domain = c.domain().unwrap_or("");
            domain.contains("jd.com") || domain.contains(".jd.com")
        })
        .map(|c| CookieInfo {
            name: c.name().to_string(),
            value: c.value().to_string(),
        })
        .collect();

    log::info!("JD cookies count: {}", jd_cookies.len());

    if jd_cookies.is_empty() {
        return Err("未找到京东Cookie，请确认已成功登录".to_string());
    }

    let has_auth_cookie = jd_cookies.iter().any(|c| {
        c.name == "pt_key" || c.name == "pt_pin" || c.name == "pt_token"
    });
    
    if !has_auth_cookie {
        return Err("未找到登录凭证，请完成登录后重试".to_string());
    }
    
    set_login_success();
    
    let cookie_string: String = jd_cookies
        .iter()
        .map(|c| format!("{}={}", c.name, c.value))
        .collect::<Vec<_>>()
        .join("; ");

    Ok(cookie_string)
}