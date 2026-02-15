use serde::Deserialize;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendErrorReport {
    source: String,
    message: String,
    stack: Option<String>,
    component_stack: Option<String>,
    url: Option<String>,
    user_agent: Option<String>,
    timestamp: String,
}

#[allow(dead_code)]
#[tauri::command]
pub fn report_frontend_error(report: FrontendErrorReport) {
    eprintln!(
        "[frontend-error] source={} message={} timestamp={}",
        report.source, report.message, report.timestamp
    );

    if let Some(url) = report.url {
        eprintln!("[frontend-error] url={}", url);
    }

    if let Some(user_agent) = report.user_agent {
        eprintln!("[frontend-error] userAgent={}", user_agent);
    }

    if let Some(component_stack) = report.component_stack {
        eprintln!("[frontend-error] componentStack={}", component_stack);
    }

    if let Some(stack) = report.stack {
        eprintln!("[frontend-error] stack={}", stack);
    }
}
