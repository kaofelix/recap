mod git;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn list_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<git::Commit>, String> {
    git::list_commits(&repo_path, limit)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, list_commits])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
