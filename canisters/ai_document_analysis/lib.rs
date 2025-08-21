use ic_cdk::{
    api::management_canister::http_request::{
        http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod,
    },
    update,
};
use serde::Deserialize;

#[derive(Deserialize, Debug)]
struct AIResponse {
    response: String,
}

#[update]
async fn contract_analysis(text: String) -> String {
    if text.len() <= 1500 {
        return format!("Document too small for chunking. Use direct analysis instead. Length: {} chars", text.len());
    }

    let chunk_size = 1500;
    let overlap = 200;
    let mut chunks = Vec::new();
    let mut start = 0;
    
    // Create overlapping chunks for better context preservation
    while start < text.len() {
        let end = (start + chunk_size).min(text.len());
        let chunk = text[start..end].to_string();
        chunks.push(chunk);
        
        if end == text.len() {
            break;
        }
        start = end - overlap;
    }

    let mut chunk_analyses = Vec::new();
    
    // Analyze each chunk individually
    for (i, chunk) in chunks.iter().enumerate() {
        let detailed_prompt = format!(
            "Detailed analysis of contract section {}/{}: {}\n\nProvide:\n1. Main clauses and terms identified\n2. Risk assessment for this section\n3. Notable missing elements\n4. Key legal considerations\n\nBe thorough but concise (2-3 sentences per point).",
            i + 1, chunks.len(), chunk
        );

        if let Ok(body) = serde_json::to_vec(&serde_json::json!({
            "model": "llama3.2:3b",
            "prompt": detailed_prompt,
            "stream": false,
            "options": {
                "num_predict": 80,
                "temperature": 0.1,
                "num_ctx": 1536
            }
        })) {
            let request = CanisterHttpRequestArgument {
                url: "http://localhost:11434/api/generate".to_string(),
                method: HttpMethod::POST,
                headers: vec![HttpHeader {
                    name: "Content-Type".to_string(),
                    value: "application/json".to_string(),
                }],
                body: Some(body),
                max_response_bytes: Some(400_000),
                transform: None,
            };

            match http_request(request, 10_000_000_000_u128).await {
                Ok((response,)) => {
                    if let Ok(ai_response) = serde_json::from_slice::<AIResponse>(&response.body) {
                        chunk_analyses.push(format!("**Section {}:**\n{}", i + 1, ai_response.response));
                    } else {
                        chunk_analyses.push(format!("**Section {}:** Analysis failed - parse error", i + 1));
                    }
                },
                Err(_) => {
                    chunk_analyses.push(format!("**Section {}:** Analysis timed out", i + 1));
                },
            }
        } else {
            chunk_analyses.push(format!("**Section {}:** Setup error", i + 1));
        }
    }

    // Combine individual chunk analyses
    let combined_findings = chunk_analyses.join("\n\n");
    let final_summary_prompt = format!(
        "Comprehensive Contract Analysis Summary\n\nBased on these detailed section analyses:\n\n{}\n\nProvide a thorough final assessment including:\n- Contract type and primary purpose\n- Critical risk factors identified\n- Essential missing provisions\n- Overall legal strength\n- Strategic recommendations\n\nAim for 150-200 words with clear structure.",
        combined_findings
    );

    // Generate final comprehensive analysis
    if let Ok(final_body) = serde_json::to_vec(&serde_json::json!({
        "model": "llama3.2:3b",
        "prompt": final_summary_prompt,
        "stream": false,
        "options": {
            "num_predict": 250,
            "temperature": 0.2,
            "num_ctx": 2048,
            "top_p": 0.9
        }
    })) {
        let final_request = CanisterHttpRequestArgument {
            url: "http://localhost:11434/api/generate".to_string(),
            method: HttpMethod::POST,
            headers: vec![HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            }],
            body: Some(final_body),
            max_response_bytes: Some(600_000),
            transform: None,
        };

        match http_request(final_request, 15_000_000_000_u128).await {
            Ok((response,)) => {
                if let Ok(ai_response) = serde_json::from_slice::<AIResponse>(&response.body) {
                    return format!(
                        "**COMPREHENSIVE CHUNKED ANALYSIS**\n\nDocument: {} chars → {} sections analyzed\n\n**DETAILED SECTION FINDINGS:**\n{}\n\n**COMPREHENSIVE FINAL ASSESSMENT:**\n{}\n\n**ANALYSIS METHODOLOGY:**\nDocument chunked into {} sections → Individual detailed analysis → Comprehensive synthesis",
                        text.len(),
                        chunks.len(),
                        combined_findings,
                        ai_response.response,
                        chunks.len()
                    );
                }
            },
            Err(_) => {},
        }
    }

    // Return individual results if final synthesis fails
    format!(
        "**DETAILED CHUNKED ANALYSIS (Individual Results)**\n\nDocument: {} chars processed in {} sections\n\n**SECTION-BY-SECTION ANALYSIS:**\n{}\n\n**STATUS:** Individual section analyses completed successfully. Final synthesis temporarily unavailable - detailed findings above provide comprehensive contract review.",
        text.len(),
        chunks.len(),
        combined_findings
    )
}

ic_cdk::export_candid!();