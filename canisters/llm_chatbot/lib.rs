use ic_cdk::update;
use ic_llm::{ChatMessage, Model};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ContractAnalysis {
    pub summary: String,
    pub key_clauses: Vec<String>,
    pub risks: Vec<String>,
    pub risk_level: String,
}

#[update]
async fn prompt(prompt_str: String) -> String {
    ic_llm::prompt(Model::Llama3_1_8B, prompt_str).await
}

#[update]
async fn chat(messages: Vec<ChatMessage>) -> String {
    let response = ic_llm::chat(Model::Llama3_1_8B)
        .with_messages(messages)
        .send()
        .await;
    
    response.message.content.unwrap_or_default()
}

fn chunk_document(document: &str, chunk_size: usize) -> Vec<String> {
    let words: Vec<&str> = document.split_whitespace().collect();
    let mut chunks = Vec::new();
    let overlap = chunk_size / 4;
    
    let mut start = 0;
    while start < words.len() {
        let end = std::cmp::min(start + chunk_size, words.len());
        chunks.push(words[start..end].join(" "));
        
        if end >= words.len() { break; }
        start = end - overlap;
    }
    
    chunks
}

async fn analyze_chunk(chunk: &str, chunk_num: usize) -> (String, Vec<String>, Vec<String>) {
    let content = if chunk.len() > 1500 {
        format!("{}...[truncated]", &chunk[..1500])
    } else {
        chunk.to_string()
    };
    
    let messages = vec![
        ChatMessage::System {
            content: "Analyze this contract section. Extract key points and risks.".to_string(),
        },
        ChatMessage::User {
            content: format!("Section {}:\n{}\n\nProvide:\nSUMMARY: [brief summary]\nKEY: [key points]\nRISKS: [risks if any]", chunk_num, content),
        },
    ];

    let response = ic_llm::chat(Model::Llama3_1_8B)
        .with_messages(messages)
        .send()
        .await;

    let content = response.message.content.unwrap_or_default();
    parse_response(&content)
}

fn parse_response(content: &str) -> (String, Vec<String>, Vec<String>) {
    let mut summary = String::new();
    let mut key_points = Vec::new();
    let mut risks = Vec::new();
    
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        
        if line.to_uppercase().starts_with("SUMMARY:") {
            summary = line[8..].trim().to_string();
        } else if line.to_uppercase().starts_with("KEY:") {
            key_points.push(line[4..].trim().to_string());
        } else if line.to_uppercase().starts_with("RISKS:") {
            let risk = line[6..].trim();
            if !risk.is_empty() && !risk.to_lowercase().contains("none") {
                risks.push(risk.to_string());
            }
        }
    }
    
    if summary.is_empty() {
        summary = content.chars().take(100).collect::<String>() + "...";
    }
    
    (summary, key_points, risks)
}

async fn generate_final_analysis(summaries: &[String], all_keys: &[String], all_risks: &[String]) -> ContractAnalysis {
    let combined = summaries.join(". ");
    
    let messages = vec![
        ChatMessage::System {
            content: "Provide final contract analysis with risk assessment.".to_string(),
        },
        ChatMessage::User {
            content: format!(
                "Contract sections: {}\nKey points: {:?}\nRisks: {:?}\n\nProvide overall summary and risk level (Low/Medium/High).",
                combined, all_keys, all_risks
            ),
        },
    ];
    
    let response = ic_llm::chat(Model::Llama3_1_8B)
        .with_messages(messages)
        .send()
        .await;
    
    let content = response.message.content.unwrap_or_default();
    let risk_level = extract_risk_level(&content);
    
    ContractAnalysis {
        summary: if content.len() > 500 { 
            format!("{}...", &content[..500])
        } else { 
            content 
        },
        key_clauses: all_keys.to_vec(),
        risks: all_risks.to_vec(),
        risk_level,
    }
}

fn extract_risk_level(content: &str) -> String {
    let lower = content.to_lowercase();
    if lower.contains("high") { "High".to_string() }
    else if lower.contains("low") { "Low".to_string() }
    else { "Medium".to_string() }
}

#[update]
async fn analyze_contract(document: String, instructions: Option<String>) -> String {
    const CHUNK_SIZE: usize = 300;
    const MAX_CHUNKS: usize = 10;
    
    if document.trim().is_empty() {
        return "Error: Document is empty".to_string();
    }
    
    let word_count = document.split_whitespace().count();
    
    // Handle small documents directly
    if word_count <= CHUNK_SIZE {
        return analyze_small_document(document, instructions).await;
    }
    
    let chunks = chunk_document(&document, CHUNK_SIZE);
    
    if chunks.len() > MAX_CHUNKS {
        return format!("Error: Document too large ({} chunks, max {})", chunks.len(), MAX_CHUNKS);
    }
    
    let mut all_summaries = Vec::new();
    let mut all_keys = Vec::new();
    let mut all_risks = Vec::new();
    
    for (i, chunk) in chunks.iter().enumerate() {
        let (summary, keys, risks) = analyze_chunk(chunk, i + 1).await;
        all_summaries.push(summary);
        all_keys.extend(keys);
        all_risks.extend(risks);
    }
    
    let analysis = generate_final_analysis(&all_summaries, &all_keys, &all_risks).await;
    format_response(&analysis)
}

async fn analyze_small_document(document: String, instructions: Option<String>) -> String {
    let prompt = instructions.unwrap_or_else(|| 
        "Analyze this contract: provide summary, key clauses, risks, and risk level.".to_string()
    );

    let messages = vec![
        ChatMessage::System {
            content: "You are a legal assistant providing contract analysis.".to_string(),
        },
        ChatMessage::User {
            content: format!("Document:\n{}\n\n{}", document, prompt),
        },
    ];

    let response = ic_llm::chat(Model::Llama3_1_8B)
        .with_messages(messages)
        .send()
        .await;

    response.message.content.unwrap_or("Analysis failed".to_string())
}

fn format_response(analysis: &ContractAnalysis) -> String {
    let mut response = String::new();
    
    response.push_str("# CONTRACT ANALYSIS\n\n");
    response.push_str(&format!("**Risk Level**: {}\n\n", analysis.risk_level));
    
    response.push_str("## Summary\n");
    response.push_str(&analysis.summary);
    response.push_str("\n\n");
    
    if !analysis.key_clauses.is_empty() {
        response.push_str("## Key Points\n");
        for (i, clause) in analysis.key_clauses.iter().enumerate() {
            response.push_str(&format!("{}. {}\n", i + 1, clause));
        }
        response.push('\n');
    }
    
    if !analysis.risks.is_empty() {
        response.push_str("## Risks\n");
        for (i, risk) in analysis.risks.iter().enumerate() {
            response.push_str(&format!("⚠️ {}. {}\n", i + 1, risk));
        }
    }
    
    response
}

ic_cdk::export_candid!();