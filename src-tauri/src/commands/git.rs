use crate::git as git_service;
use crate::repo_cache::RepoCache;

#[tauri::command]
pub fn list_commits(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    limit: Option<usize>,
    author_emails: Option<Vec<String>>,
) -> Result<Vec<git_service::Commit>, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::list_commits(repo, limit, author_emails.clone())
    })
}

#[tauri::command]
pub fn list_authors(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<Vec<git_service::Author>, String> {
    state.with_repo(&repo_path, |repo| git_service::list_authors(repo))
}

#[tauri::command]
pub fn get_commit_files(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_id: String,
) -> Result<Vec<git_service::ChangedFile>, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_commit_files(repo, &commit_id)
    })
}

#[tauri::command]
pub fn get_commit_range_files(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_ids: Vec<String>,
) -> Result<Vec<git_service::ChangedFile>, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_commit_range_files(repo, &commit_ids)
    })
}

#[tauri::command]
pub fn get_file_diff(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_file_diff(repo, &commit_id, &file_path)
    })
}

#[tauri::command]
pub fn get_file_contents(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_id: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_file_contents(repo, &commit_id, &file_path)
    })
}

#[tauri::command]
pub fn get_commit_range_file_contents(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_ids: Vec<String>,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_commit_range_file_contents(repo, &commit_ids, &file_path)
    })
}

#[tauri::command]
pub fn get_current_branch(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<String, String> {
    state.with_repo(&repo_path, |repo| git_service::get_current_branch(repo))
}

#[tauri::command]
pub fn list_branches(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<Vec<git_service::Branch>, String> {
    state.with_repo(&repo_path, |repo| git_service::list_branches(repo))
}

#[tauri::command]
pub fn checkout_branch(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    branch_name: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| {
        git_service::checkout_branch(repo, &branch_name)
    })
}

#[tauri::command]
pub fn validate_repo(
    state: tauri::State<'_, RepoCache>,
    path: String,
) -> Result<git_service::RepoInfo, String> {
    state.with_repo(&path, |repo| git_service::validate_repo(repo))
}

#[tauri::command]
pub fn get_working_changes(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<Vec<git_service::ChangedFile>, String> {
    state.with_repo(&repo_path, |repo| git_service::get_working_changes(repo))
}

#[tauri::command]
pub fn get_working_file_diff(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_working_file_diff(repo, &file_path)
    })
}

#[tauri::command]
pub fn get_working_file_contents(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_working_file_contents(repo, &file_path)
    })
}

#[tauri::command]
pub fn get_working_changes_ex(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<Vec<git_service::WorkingFile>, String> {
    state.with_repo(&repo_path, |repo| git_service::get_working_changes_ex(repo))
}

#[tauri::command]
pub fn get_staged_file_diff(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_staged_file_diff(repo, &file_path)
    })
}

#[tauri::command]
pub fn get_unstaged_file_diff(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileDiff, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_unstaged_file_diff(repo, &file_path)
    })
}

#[tauri::command]
pub fn get_staged_file_contents(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_staged_file_contents(repo, &file_path)
    })
}

#[tauri::command]
pub fn get_unstaged_file_contents(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<git_service::FileContents, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_unstaged_file_contents(repo, &file_path)
    })
}

#[tauri::command]
pub fn stage_file(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| {
        git_service::stage_file(repo, &file_path)
    })
}

#[tauri::command]
pub fn stage_all(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| git_service::stage_all(repo))
}

#[tauri::command]
pub fn unstage_file(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| {
        git_service::unstage_file(repo, &file_path)
    })
}

#[tauri::command]
pub fn unstage_all(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| git_service::unstage_all(repo))
}

#[tauri::command]
pub fn discard_file(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    file_path: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| {
        git_service::discard_file(repo, &file_path)
    })
}

#[tauri::command]
pub fn create_commit(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    message: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| {
        git_service::create_commit(repo, &message)
    })
}

#[tauri::command]
pub fn get_remote_url(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<String, String> {
    state.with_repo(&repo_path, |repo| git_service::get_remote_url(repo))
}

#[tauri::command]
pub fn get_ahead_behind(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
) -> Result<git_service::AheadBehind, String> {
    state.with_repo(&repo_path, |repo| git_service::get_ahead_behind(repo))
}

#[tauri::command]
pub fn get_commit_message(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_id: String,
) -> Result<String, String> {
    state.with_repo(&repo_path, |repo| {
        git_service::get_commit_message(repo, &commit_id)
    })
}

#[tauri::command]
pub fn reword_commit(
    state: tauri::State<'_, RepoCache>,
    repo_path: String,
    commit_id: String,
    new_message: String,
) -> Result<(), String> {
    state.with_repo(&repo_path, |repo| {
        git_service::reword_commit(repo, &commit_id, &new_message)
    })
}
