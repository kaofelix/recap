use crate::git as git_service;

#[tauri::command]
pub fn list_commits(
    repo_path: String,
    limit: Option<usize>,
    author_emails: Option<Vec<String>>,
) -> Result<Vec<git_service::Commit>, String> {
    git_service::list_commits(&repo_path, limit, author_emails)
}

#[tauri::command]
pub fn get_commit_files(
    repo_path: String,
    commit_id: String,
) -> Result<Vec<git_service::ChangedFile>, String> {
    git_service::get_commit_files(&repo_path, &commit_id)
}

#[tauri::command]
pub fn get_commit_range_files(
    repo_path: String,
    commit_ids: Vec<String>,
) -> Result<Vec<git_service::ChangedFile>, String> {
    git_service::get_commit_range_files(&repo_path, &commit_ids)
}

#[tauri::command]
pub fn get_file_diff(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    git_service::get_file_diff(&repo_path, &commit_id, &file_path)
}

#[tauri::command]
pub fn get_file_contents(
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    git_service::get_file_contents(&repo_path, &commit_id, &file_path)
}

#[tauri::command]
pub fn get_commit_range_file_contents(
    repo_path: String,
    commit_ids: Vec<String>,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    git_service::get_commit_range_file_contents(&repo_path, &commit_ids, &file_path)
}

#[tauri::command]
pub fn get_current_branch(repo_path: String) -> Result<String, String> {
    git_service::get_current_branch(&repo_path)
}

#[tauri::command]
pub fn list_branches(repo_path: String) -> Result<Vec<git_service::Branch>, String> {
    git_service::list_branches(&repo_path)
}

#[tauri::command]
pub fn checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    git_service::checkout_branch(&repo_path, &branch_name)
}

#[tauri::command]
pub fn validate_repo(path: String) -> Result<git_service::RepoInfo, String> {
    git_service::validate_repo(&path)
}

#[tauri::command]
pub fn get_working_changes(repo_path: String) -> Result<Vec<git_service::ChangedFile>, String> {
    git_service::get_working_changes(&repo_path)
}

#[tauri::command]
pub fn get_working_file_diff(
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    git_service::get_working_file_diff(&repo_path, &file_path)
}

#[tauri::command]
pub fn get_working_file_contents(
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    git_service::get_working_file_contents(&repo_path, &file_path)
}

#[tauri::command]
pub fn get_working_changes_ex(
    repo_path: String,
) -> Result<Vec<git_service::WorkingFile>, String> {
    git_service::get_working_changes_ex(&repo_path)
}

#[tauri::command]
pub fn get_staged_file_diff(
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    git_service::get_staged_file_diff(&repo_path, &file_path)
}

#[tauri::command]
pub fn get_unstaged_file_diff(
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    git_service::get_unstaged_file_diff(&repo_path, &file_path)
}

#[tauri::command]
pub fn get_staged_file_contents(
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    git_service::get_staged_file_contents(&repo_path, &file_path)
}

#[tauri::command]
pub fn get_unstaged_file_contents(
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    git_service::get_unstaged_file_contents(&repo_path, &file_path)
}

#[tauri::command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_service::stage_file(&repo_path, &file_path)
}

#[tauri::command]
pub fn stage_all(repo_path: String) -> Result<(), String> {
    git_service::stage_all(&repo_path)
}

#[tauri::command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_service::unstage_file(&repo_path, &file_path)
}

#[tauri::command]
pub fn unstage_all(repo_path: String) -> Result<(), String> {
    git_service::unstage_all(&repo_path)
}

#[tauri::command]
pub fn discard_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_service::discard_file(&repo_path, &file_path)
}

#[tauri::command]
pub fn create_commit(repo_path: String, message: String) -> Result<(), String> {
    git_service::create_commit(&repo_path, &message)
}

#[tauri::command]
pub fn get_remote_url(repo_path: String) -> Result<String, String> {
    git_service::get_remote_url(&repo_path)
}

#[tauri::command]
pub fn get_ahead_behind(repo_path: String) -> Result<git_service::AheadBehind, String> {
    git_service::get_ahead_behind(&repo_path)
}

#[tauri::command]
pub fn get_commit_message(repo_path: String, commit_id: String) -> Result<String, String> {
    git_service::get_commit_message(&repo_path, &commit_id)
}

#[tauri::command]
pub fn reword_commit(
    repo_path: String,
    commit_id: String,
    new_message: String,
) -> Result<(), String> {
    git_service::reword_commit(&repo_path, &commit_id, &new_message)
}
