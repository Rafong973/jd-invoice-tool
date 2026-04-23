use tauri::command;
use serde::{Deserialize, Serialize};
use crate::api::jd::JdApi;
use crate::utils::file::read_cookie_file;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeGroup {
    pub org_name: String,
    pub total: f64,
    pub orders: Vec<serde_json::Value>,
}

#[command]
pub async fn fetch_batch_orders() -> Result<Vec<serde_json::Value>, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);
    api.get_all_batch_orders().await
}

fn extract_amount(order: &serde_json::Value) -> f64 {
    let ivc_amount = order
        .get("ivcAmount")
        .and_then(|v| v.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| v.as_f64()));
    let actual_pay_money = order
        .get("actualPayMoney")
        .and_then(|v| v.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| v.as_f64()));

    match (ivc_amount, actual_pay_money) {
        (Some(ivc), Some(actual)) if ivc > actual => (ivc - actual).max(0.0),
        (Some(ivc), _) => ivc,
        _ => 0.0,
    }
}

#[command]
pub async fn check_merge(order_list_json: String) -> Result<Vec<MergeGroup>, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);
    let groups = api.check_merge(&order_list_json).await?;

    eprintln!("[DEBUG] check_merge: received {} groups from API", groups.len());

    let mut result = Vec::new();
    for (i, group) in groups.iter().enumerate() {
        let org_name = group.org_name.clone().unwrap_or_else(|| "未知开票方".to_string());
        let mut total = 0.0;
        let mut orders = Vec::new();

        if let Some(order_list) = &group.order_list {
            eprintln!("[DEBUG] group[{}] '{}': {} orders", i, org_name, order_list.len());
            for order in order_list {
                let amount = extract_amount(order);
                total += amount;
                orders.push(order.clone());
            }
        }

        eprintln!("[DEBUG] group[{}] '{}': total={}, orders={}", i, org_name, total, orders.len());

        if total > 0.0 && !orders.is_empty() {
            result.push(MergeGroup {
                org_name,
                total,
                orders,
            });
        }
    }

    eprintln!("[DEBUG] check_merge: returning {} groups", result.len());

    Ok(result)
}
