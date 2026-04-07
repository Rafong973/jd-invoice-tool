use tauri::command;
use serde::{Deserialize, Serialize};
use crate::api::jd::JdApi;
use crate::utils::file::read_cookie_file;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceItem {
    pub order_id: String,
    pub ivc_title: String,
    pub ivc_status: String,
    pub ivc_type: String,
    pub ivc_content_name: String,
    pub amount: String,
    pub can_hk: bool,
    pub is_jd: bool,
    pub vender_name: String,
    pub products: Vec<serde_json::Value>,
    pub raw: serde_json::Value,
}

fn get_val(value: &serde_json::Value, key: &str) -> String {
    match value.get(key) {
        Some(v) => {
            if let Some(s) = v.as_str() {
                s.to_string()
            } else if let Some(n) = v.as_i64() {
                n.to_string()
            } else if let Some(n) = v.as_f64() {
                n.to_string()
            } else if v.is_null() {
                String::new()
            } else {
                v.to_string()
            }
        }
        None => String::new(),
    }
}

#[command]
pub async fn fetch_invoices(page: u32) -> Result<Vec<InvoiceItem>, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);
    let orders = api.get_invoice_list(page).await?;

    let order_amount_queries: Vec<String> = orders
        .iter()
        .filter_map(|o| {
            let pk = get_val(o, "orderAmountQuery");
            if !pk.is_empty() { Some(pk) } else { None }
        })
        .collect();

    let amount_map = if !order_amount_queries.is_empty() {
        match api.get_orders_amount(&order_amount_queries).await {
            Ok(json) => {
                eprintln!("[DEBUG] get_orders_amount full response: {}", serde_json::to_string(&json).unwrap_or_default());
                let mut map = std::collections::HashMap::new();
                let data = json.get("data");
                eprintln!("[DEBUG] get_orders_amount data type: {:?}", data.map(|d| match d { serde_json::Value::Null => "null", serde_json::Value::Array(_) => "array", serde_json::Value::Object(_) => "object", serde_json::Value::String(_) => "string", _ => "other" }));
                if let Some(data_str) = data.and_then(|d| d.as_str()) {
                    eprintln!("[DEBUG] get_orders_amount data is string: {}", data_str);
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data_str) {
                        if let Some(arr) = parsed.as_array() {
                            for item in arr {
                                let oid = item.get("orderId").and_then(|v| v.as_str()).unwrap_or("");
                                let amt = item.get("money").and_then(|v| v.as_str()).unwrap_or("");
                                if !oid.is_empty() {
                                    map.insert(oid.to_string(), amt.to_string());
                                }
                            }
                        } else if let Some(obj) = parsed.as_object() {
                            for (k, v) in obj {
                                let amt = v.get("money").and_then(|v| v.as_str()).unwrap_or("");
                                if amt.is_empty() {
                                    if let Some(s) = v.as_str() { map.insert(k.clone(), s.to_string()); }
                                } else {
                                    map.insert(k.clone(), amt.to_string());
                                }
                            }
                        }
                    }
                } else if let Some(data_arr) = data.and_then(|d| d.as_array()) {
                    for item in data_arr {
                        let oid = item.get("orderId").and_then(|v| v.as_str()).unwrap_or("");
                        let amt = item.get("money").and_then(|v| v.as_str()).unwrap_or("");
                        if !oid.is_empty() {
                            map.insert(oid.to_string(), amt.to_string());
                        }
                    }
                } else if let Some(data_obj) = data.and_then(|d| d.as_object()) {
                    for (k, v) in data_obj {
                        let amt = v.get("money").and_then(|v| v.as_str()).unwrap_or("");
                        if !amt.is_empty() {
                            map.insert(k.clone(), amt.to_string());
                        }
                    }
                }
                eprintln!("[DEBUG] amount_map: {:?}", map);
                map
            }
            Err(e) => {
                eprintln!("[DEBUG] get_orders_amount failed: {}", e);
                std::collections::HashMap::new()
            }
        }
    } else {
        std::collections::HashMap::new()
    };

    let mut results = Vec::new();
    for order in &orders {
        let order_id = get_val(order, "orderId");
        let amount = amount_map.get(&order_id).cloned().unwrap_or_default();

        results.push(InvoiceItem {
            order_id: get_val(order, "orderId"),
            ivc_title: get_val(order, "ivcTitle"),
            ivc_status: get_val(order, "ivcStatus"),
            ivc_type: get_val(order, "ivcType"),
            ivc_content_name: get_val(order, "ivcContentName"),
            amount,
            can_hk: order.get("canHk").and_then(|v| v.as_bool()).unwrap_or(false),
            is_jd: order.get("isJd").and_then(|v| v.as_bool()).unwrap_or(false),
            vender_name: get_val(order, "venderName"),
            products: order.get("products").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
            raw: order.clone(),
        });
    }

    Ok(results)
}

#[command]
pub async fn fetch_invoice_detail(order_id: String) -> Result<Vec<crate::api::jd::InvoiceFile>, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);
    api.get_invoice_detail(&order_id).await
}
