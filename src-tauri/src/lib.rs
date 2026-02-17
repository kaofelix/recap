mod commands;
mod git;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::errors::report_frontend_error,
            commands::git::list_commits,
            commands::git::get_commit_files,
            commands::git::get_commit_range_files,
            commands::git::get_file_diff,
            commands::git::get_file_contents,
            commands::git::get_commit_range_file_contents,
            commands::git::get_current_branch,
            commands::git::list_branches,
            commands::git::checkout_branch,
            commands::git::validate_repo,
            commands::git::get_working_changes,
            commands::git::get_working_file_diff,
            commands::git::get_working_file_contents
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
