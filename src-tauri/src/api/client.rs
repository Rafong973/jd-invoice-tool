use reqwest::Client;

const BASE_USER_AGENT: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1";

pub fn build_client(cookie: &str) -> Result<Client, String> {
    Client::builder()
        .user_agent(BASE_USER_AGENT)
        .default_headers({
            let mut headers = reqwest::header::HeaderMap::new();
            headers.insert(
                "Accept",
                "application/json, text/plain, */*".parse().unwrap(),
            );
            headers.insert("Accept-Language", "zh-CN,zh-Hans;q=0.9".parse().unwrap());
            headers.insert("Referer", "https://invoice-m.jd.com/".parse().unwrap());
            headers.insert("Origin", "https://invoice-m.jd.com".parse().unwrap());
            headers.insert("Sec-Fetch-Site", "same-site".parse().unwrap());
            headers.insert("Sec-Fetch-Mode", "cors".parse().unwrap());
            headers.insert("Sec-Fetch-Dest", "empty".parse().unwrap());
            headers.insert("x-source", "2".parse().unwrap());
            headers.insert("x-source-id", "0".parse().unwrap());
            headers.insert("Cookie", cookie.parse().unwrap());
            headers
        })
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}
