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

#[tauri::command]
fn get_commit_files(
    repo_path: String,
    commit_id: String,
) -> Result<Vec<git::ChangedFile>, String> {
    git::get_commit_files(&repo_path, &commit_id)
}

#[tauri::command]
fn get_file_diff(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<git::FileDiff, String> {
    git::get_file_diff(&repo_path, &commit_id, &file_path)
}

#[tauri::command]
fn get_file_contents(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<git::FileContents, String> {
    git::get_file_contents(&repo_path, &commit_id, &file_path)
}

#[tauri::command]
fn get_current_branch(repo_path: String) -> Result<String, String> {
    git::get_current_branch(&repo_path)
}

#[tauri::command]
fn validate_repo(path: String) -> Result<git::RepoInfo, String> {
    git::validate_repo(&path)
}

#[tauri::command]
fn get_working_changes(repo_path: String) -> Result<Vec<git::ChangedFile>, String> {
    git::get_working_changes(&repo_path)
}

#[tauri::command]
fn get_working_file_diff(repo_path: String, file_path: String) -> Result<git::FileDiff, String> {
    git::get_working_file_diff(&repo_path, &file_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_commits,
            get_commit_files,
            get_file_diff,
            get_file_contents,
            get_current_branch,
            validate_repo,
            get_working_changes,
            get_working_file_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
