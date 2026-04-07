use serde::{Deserialize, Serialize};
use crate::api::client::build_client;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceFile {
    #[serde(rename = "ivcNo", default)]
    pub ivc_no: String,
    #[serde(default)]
    pub amount: String,
    #[serde(rename = "invoiceDate", default)]
    pub invoice_date: String,
    #[serde(rename = "fileUrl", default)]
    pub file_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeGroupItem {
    #[serde(rename = "orgName")]
    pub org_name: Option<String>,
    #[serde(rename = "orderList")]
    pub order_list: Option<Vec<serde_json::Value>>,
}

fn parse_data_field(json: &serde_json::Value) -> Option<serde_json::Value> {
    let data = json.get("data")?;
    if let Some(s) = data.as_str() {
        serde_json::from_str(s).ok()
    } else {
        Some(data.clone())
    }
}

fn extract_orders(data: &serde_json::Value) -> Vec<serde_json::Value> {
    // 尝试 data.orders
    if let Some(arr) = data.get("orders").and_then(|o| o.as_array()) {
        return arr.clone();
    }
    // 尝试 data.data.orders
    if let Some(inner) = data.get("data") {
        if let Some(arr) = inner.get("orders").and_then(|o| o.as_array()) {
            return arr.clone();
        }
        // 尝试 data.data 是数组
        if let Some(arr) = inner.as_array() {
            return arr.clone();
        }
    }
    // 尝试 data 本身就是数组
    if let Some(arr) = data.as_array() {
        return arr.clone();
    }
    Vec::new()
}

fn parse_json_array(value: Option<&serde_json::Value>) -> Vec<serde_json::Value> {
    match value {
        Some(v) => {
            if let Some(arr) = v.as_array() {
                arr.clone()
            } else if let Some(s) = v.as_str() {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(s) {
                    parsed.as_array().cloned().unwrap_or_default()
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            }
        }
        None => Vec::new(),
    }
}

pub struct JdApi {
    cookie: String,
}

impl JdApi {
    pub fn new(cookie: String) -> Self {
        Self { cookie }
    }

    pub async fn get_invoice_list(&self, page: u32) -> Result<Vec<serde_json::Value>, String> {
        let client = build_client(&self.cookie)?;
        let url = format!(
            "https://api.m.jd.com/api?functionId=appFpzz_getAllNextOrderPage&appid=invoice-m&xAPIClientLanguage=zh_CN&xAPICurrency=CNY&xAPIRegion=CN&xAPITz=Asia%2FShanghai&xAPIElder=0&page={}",
            page
        );

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Parse JSON failed: {}", e))?;

        let data = parse_data_field(&json).unwrap_or_default();
        let orders = extract_orders(&data);

        Ok(orders)
    }

    pub async fn get_orders_amount(&self, pass_keys: &[String]) -> Result<serde_json::Value, String> {
        let client = build_client(&self.cookie)?;
        let order_ids = pass_keys.join(";");
        let encoded_ids: String = order_ids
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '~' | '+' | '/') {
                    c.to_string()
                } else {
                    format!("%{:02X}", c as u8)
                }
            })
            .collect();
        let url = format!(
            "https://myivc.jd.com/newIvc/appFpzz/getAppOrdersAmountAsync.action?orderIds={}",
            encoded_ids
        );

        eprintln!("[DEBUG] get_orders_amount pass_keys count={}", pass_keys.len());
        eprintln!("[DEBUG] get_orders_amount url: {}", url);

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Parse JSON failed: {}", e))?;

        eprintln!("[DEBUG] get_orders_amount raw response: {}", serde_json::to_string(&json).unwrap_or_default());

        Ok(json)
    }

    pub async fn get_invoice_detail(&self, order_id: &str) -> Result<Vec<InvoiceFile>, String> {
        let client = build_client(&self.cookie)?;
        let url = format!(
            "https://myivc.jd.com/newIvc/appFpzz/appPreviewInvoice.action?orderId={}&canCard=0&canShare=true",
            order_id
        );

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Parse JSON failed: {}", e))?;

        eprintln!("[DEBUG] get_invoice_detail orderId={} raw response: {}", order_id, serde_json::to_string(&json).unwrap_or_default());

        let data = parse_data_field(&json).unwrap_or(serde_json::Value::Null);

        let file_list = parse_json_array(data.get("fileUrlList"));

        eprintln!("[DEBUG] get_invoice_detail orderId={} fileUrlList count={}", order_id, file_list.len());

        let files = file_list
            .iter()
            .filter_map(|v| serde_json::from_value::<InvoiceFile>(v.clone()).ok())
            .collect::<Vec<_>>();

        Ok(files)
    }

    pub async fn get_batch_list(&self, page: u32) -> Result<Vec<serde_json::Value>, String> {
        let client = build_client(&self.cookie)?;
        let url = format!(
            "https://myivc.jd.com/newIvc/appFpzz/getBatchNextOrderPage.action?page={}",
            page
        );

        let res = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Parse JSON failed: {}", e))?;

        eprintln!("[DEBUG] get_batch_list page={} raw response: {}", page, serde_json::to_string(&json).unwrap_or_default());

        let data = parse_data_field(&json).unwrap_or_default();
        let orders = extract_orders(&data);

        eprintln!("[DEBUG] get_batch_list page={} orders count={}", page, orders.len());

        Ok(orders)
    }

    pub async fn get_all_batch_orders(&self) -> Result<Vec<serde_json::Value>, String> {
        let mut all = Vec::new();
        let mut page = 1;

        loop {
            let list = self.get_batch_list(page).await?;
            if list.is_empty() {
                break;
            }
            for order in list {
                if let Some(info) = order.get("originalOrderInfo").cloned() {
                    all.push(info);
                }
            }
            page += 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
        }

        eprintln!("[DEBUG] get_all_batch_orders total={}", all.len());

        Ok(all)
    }

    pub async fn check_merge(&self, user_order_list_json: &str) -> Result<Vec<MergeGroupItem>, String> {
        let client = build_client(&self.cookie)?;
        let body = format!(
            "userOrderListJson={}&batchSelfInvoiceReqJson=BOWblSt7NzlDfq1MuE/ixaG3nBRJvhgNyOwR95Du8dqkpzFZdqKOGiJL/mv88dm19KqPeZ42UbP2AXqcXG0v0Kt/eE3P9bU05eI0qRx1PRL06PFKgQPZH66aV1lFPrjRpWVQVgtZRIS4XQ7FhqdvPC/tV7/0CUSaKBKEnzdFr63D7UiQyRBXaEFO2B8RJERSjxUXsjfxFLXvF/oBvDoGRu5hUprZJa6SOHMbPwiPPzCeFWAPCM3Fi0hZPsDMfzqDL/maWsxtvE01e1jBPmpLTA==",
            user_order_list_json
        );

        let res = client
            .post("https://myivc.jd.com/newIvc/appFpzz/checkMergeHkfpReq.action")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Parse JSON failed: {}", e))?;

        eprintln!("[DEBUG] check_merge raw response: {}", serde_json::to_string(&json).unwrap_or_default());

        let data = parse_data_field(&json).unwrap_or(serde_json::Value::Null);

        let group_list = parse_json_array(data.get("groupList"));

        eprintln!("[DEBUG] check_merge groupList count={}", group_list.len());

        let groups = group_list
            .iter()
            .filter_map(|v| serde_json::from_value::<MergeGroupItem>(v.clone()).ok())
            .collect::<Vec<_>>();

        Ok(groups)
    }
}
