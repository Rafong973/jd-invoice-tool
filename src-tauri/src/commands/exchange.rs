use crate::api::jd::{encrypt_aes_cbc_base64, JdApi};
use crate::utils::file::read_cookie_file;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchOrderSeed {
    pub order_id: String,
    pub order_amount_query: String,
    pub resolved_amount: Option<String>,
    pub original_order_info: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeGroup {
    pub org_name: String,
    pub total: f64,
    pub orders: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeExchangeTitleInput {
    pub title_type: String,
    pub title_name: String,
    pub email: String,
    pub tax_no: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeExchangeResult {
    pub all_success: bool,
    pub message: String,
    pub order_count: usize,
    pub can_merge_count: usize,
    pub cannot_merge_count: usize,
    pub group_count: usize,
}

fn parse_amount_map(json: &serde_json::Value) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let data = json.get("data");

    if let Some(data_str) = data.and_then(|value| value.as_str()) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data_str) {
            if let Some(arr) = parsed.as_array() {
                for item in arr {
                    let order_id = item.get("orderId").and_then(|value| value.as_str()).unwrap_or("");
                    let amount = item.get("money").and_then(|value| value.as_str()).unwrap_or("");
                    if !order_id.is_empty() && !amount.is_empty() {
                        map.insert(order_id.to_string(), amount.to_string());
                    }
                }
            }
        }
    } else if let Some(arr) = data.and_then(|value| value.as_array()) {
        for item in arr {
            let order_id = item.get("orderId").and_then(|value| value.as_str()).unwrap_or("");
            let amount = item.get("money").and_then(|value| value.as_str()).unwrap_or("");
            if !order_id.is_empty() && !amount.is_empty() {
                map.insert(order_id.to_string(), amount.to_string());
            }
        }
    }

    map
}

fn parse_data_field(json: &serde_json::Value) -> serde_json::Value {
    match json.get("data") {
        Some(serde_json::Value::String(value)) => {
            serde_json::from_str(value).unwrap_or(serde_json::Value::Null)
        }
        Some(value) => value.clone(),
        None => serde_json::Value::Null,
    }
}

fn json_success(json: &serde_json::Value) -> bool {
    match json.get("code") {
        Some(serde_json::Value::Number(value)) => value.as_i64() == Some(0),
        Some(serde_json::Value::String(value)) => value == "0",
        _ => false,
    }
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

fn extract_string(value: Option<&serde_json::Value>) -> String {
    match value {
        Some(serde_json::Value::String(text)) => text.trim().to_string(),
        Some(serde_json::Value::Number(number)) => number.to_string(),
        Some(serde_json::Value::Bool(boolean)) => boolean.to_string(),
        _ => String::new(),
    }
}

fn extract_i64(value: Option<&serde_json::Value>, default: i64) -> i64 {
    value
        .and_then(|item| {
            item.as_i64().or_else(|| {
                item.as_str()
                    .and_then(|text| text.parse::<i64>().ok())
            })
        })
        .unwrap_or(default)
}

fn extract_original_order_info(order: &serde_json::Value) -> Result<serde_json::Value, String> {
    let order_id = extract_string(order.get("orderId"));
    if order_id.is_empty() {
        return Err("Selected order is missing orderId".to_string());
    }

    order
        .get("originalOrderInfo")
        .cloned()
        .ok_or_else(|| format!("Order {} is missing originalOrderInfo", order_id))
}

fn slim_merge_order(order: &serde_json::Value) -> serde_json::Value {
    let detail_list = order
        .get("detailList")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .take(1)
                .map(|item| {
                    json!({
                        "skuName": extract_string(item.get("skuName")),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    json!({
        "orderId": extract_string(order.get("orderId")),
        "orgId": order.get("orgId").cloned().unwrap_or(serde_json::Value::Null),
        "orderTime": extract_string(order.get("orderTime")),
        "ivcTime": extract_string(order.get("ivcTime")),
        "ivcCompany": extract_string(order.get("ivcCompany")),
        "ivcTitle": extract_string(order.get("ivcTitle")),
        "ivcAmount": order.get("ivcAmount").cloned().unwrap_or(serde_json::Value::Null),
        "totalAmount": order.get("totalAmount").cloned().unwrap_or(serde_json::Value::Null),
        "actualPayMoney": order.get("actualPayMoney").cloned().unwrap_or(serde_json::Value::Null),
        "detailList": detail_list,
        "originalOrderInfo": order.get("originalOrderInfo").cloned().unwrap_or_else(|| order.clone()),
    })
}

fn build_batch_request_json(
    title: &MergeExchangeTitleInput,
    req: &serde_json::Value,
) -> serde_json::Value {
    let is_company = title.title_type == "company";
    let ivc_title_type = if is_company { 5 } else { 4 };
    let ivc_title = title.title_name.trim();

    json!({
        "ivcTitleType": ivc_title_type,
        "ivcTitle": ivc_title,
        "ivcType": extract_i64(req.get("ivcType"), 3),
        "taxNo": if is_company { title.tax_no.trim() } else { "" },
        "registAddress": extract_string(req.get("regAddress").or_else(|| req.get("registAddress"))),
        "registPhone": extract_string(req.get("regTel").or_else(|| req.get("registPhone"))),
        "bank": extract_string(req.get("regBank").or_else(|| req.get("bank"))),
        "bankAccount": extract_string(req.get("regAccount").or_else(|| req.get("bankAccount"))),
        "ivcContent": extract_i64(req.get("ivcContent"), 1),
        "customerName": extract_string(req.get("customerName")),
        "customerTel": extract_string(req.get("customerTel")),
        "province": extract_i64(req.get("province"), 0),
        "city": extract_i64(req.get("city"), 0),
        "county": extract_i64(req.get("county"), 0),
        "provinceName": extract_string(req.get("provinceName")),
        "cityName": extract_string(req.get("cityName")),
        "countyName": extract_string(req.get("countyName")),
        "address": extract_string(req.get("address")),
        "changeReason": "",
        "email": title.email.trim(),
    })
}

#[command]
pub async fn fetch_batch_orders() -> Result<Vec<BatchOrderSeed>, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);
    let orders = api.get_all_batch_orders().await?;
    Ok(orders
        .into_iter()
        .map(|order| BatchOrderSeed {
            order_id: order.order_id,
            order_amount_query: order.order_amount_query,
            resolved_amount: order.resolved_amount,
            original_order_info: order.original_order_info,
        })
        .collect())
}

#[command]
pub async fn fetch_batch_order_amounts(
    order_amount_queries: Vec<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);
    let json = api.get_orders_amount(&order_amount_queries).await?;
    Ok(parse_amount_map(&json))
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
                orders.push(slim_merge_order(order));
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

#[command]
pub async fn submit_merge_exchange(
    selected_orders: Vec<serde_json::Value>,
    title: MergeExchangeTitleInput,
) -> Result<MergeExchangeResult, String> {
    if selected_orders.is_empty() {
        return Err("No invoices selected".to_string());
    }

    if title.title_name.trim().is_empty() {
        return Err("Invoice title is required".to_string());
    }

    let cookie = read_cookie_file()?.ok_or("Cookie not found, please login first")?;
    let api = JdApi::new(cookie);

    let original_order_infos = selected_orders
        .iter()
        .map(extract_original_order_info)
        .collect::<Result<Vec<_>, _>>()?;

    // JD's H5 flow stores JSON.stringify(checkList.map(item => item.originalOrderInfo))
    // into sessionStorage, then passes that exact string to appBatchHkfpReq.action.
    let original_order_infos_json = serde_json::to_string(&original_order_infos)
        .map_err(|e| format!("Failed to serialize originalOrderInfo list: {}", e))?;

    eprintln!(
        "[DEBUG] submit_merge_exchange appBatchHkfpReq orders count={} payload_preview={}",
        original_order_infos.len(),
        original_order_infos_json.chars().take(240).collect::<String>()
    );

    let batch_context_json = api.get_batch_bk_orders(&original_order_infos_json).await?;
    let batch_context = parse_data_field(&batch_context_json);
    let press_key = extract_string(batch_context.get("pressKey"));
    if press_key.is_empty() {
        return Err("JD response missing pressKey".to_string());
    }

    if let Some(vat_check_orders) = batch_context.get("vatCheckOrders").and_then(|value| value.as_str()) {
        if !vat_check_orders.is_empty() {
            let _ = api.get_app_batch_can_vat_async(vat_check_orders).await;
        }
    }

    let req = batch_context
        .get("req")
        .cloned()
        .filter(|value| value.is_object())
        .ok_or_else(|| "JD response missing req payload".to_string())?;

    let batch_request = build_batch_request_json(&title, &req);
    let batch_request_json = serde_json::to_string(&batch_request)
        .map_err(|e| format!("Failed to serialize merge request: {}", e))?;
    let batch_self_invoice_req_json =
        encrypt_aes_cbc_base64(&batch_request_json, &press_key, &press_key)?;

    let user_order_list_json = serde_json::to_string(&original_order_infos)
        .map_err(|e| format!("Failed to serialize originalOrderInfo list: {}", e))?;

    let merge_check_json = api
        .check_merge_hkfp_req(&batch_self_invoice_req_json, &user_order_list_json)
        .await?;
    let merge_check_data = parse_data_field(&merge_check_json);
    let group_list = merge_check_data
        .get("groupList")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::Array(Vec::new()));
    let summary = merge_check_data
        .get("summary")
        .cloned()
        .unwrap_or_else(|| json!({}));

    let group_count = summary
        .get("groupCount")
        .and_then(|value| value.as_u64())
        .unwrap_or(0) as usize;
    let can_merge_count = summary
        .get("canMergeCount")
        .and_then(|value| value.as_u64())
        .unwrap_or(0) as usize;
    let cannot_merge_count = summary
        .get("cannotMergeCount")
        .and_then(|value| value.as_u64())
        .unwrap_or(0) as usize;
    let order_count = summary
        .get("orderCount")
        .and_then(|value| value.as_u64())
        .unwrap_or(selected_orders.len() as u64) as usize;

    if group_count == 0 || !group_list.is_array() || group_list.as_array().is_none_or(|items| items.is_empty()) {
        return Err("当前选择的订单没有可提交的合并换开组合".to_string());
    }

    let merge_group_plain_json = serde_json::to_string(&group_list)
        .map_err(|e| format!("Failed to serialize groupList: {}", e))?;
    let merge_group_list_json =
        encrypt_aes_cbc_base64(&merge_group_plain_json, &press_key, &press_key)?;

    let submit_json = api
        .app_do_merge_hkfp_req(&batch_self_invoice_req_json, &merge_group_list_json)
        .await?;
    let submit_data = parse_data_field(&submit_json);
    let all_success = submit_data
        .get("allSuccess")
        .and_then(|value| value.as_bool())
        .unwrap_or_else(|| json_success(&submit_json));

    if !all_success {
        return Err("JD returned allSuccess=false for merge exchange submission".to_string());
    }

    let message = if cannot_merge_count > 0 {
        format!(
            "合并换开已提交：共选 {} 单，可合并 {} 单，已生成 {} 张发票，另有 {} 单未合并。",
            order_count, can_merge_count, group_count, cannot_merge_count
        )
    } else {
        format!(
            "合并换开已提交：共选 {} 单，已合并为 {} 张发票。",
            order_count, group_count
        )
    };

    Ok(MergeExchangeResult {
        all_success,
        message,
        order_count,
        can_merge_count,
        cannot_merge_count,
        group_count,
    })
}
