use git2::{build::CheckoutBuilder, BranchType, Delta, DiffOptions, Repository};
use serde::Serialize;

/// Status of a file in a commit or working directory
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum FileStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Unmodified,
    Untracked,
}

impl From<Delta> for FileStatus {
    fn from(delta: Delta) -> Self {
        match delta {
            Delta::Added => FileStatus::Added,
            Delta::Deleted => FileStatus::Deleted,
            Delta::Modified => FileStatus::Modified,
            Delta::Renamed => FileStatus::Renamed,
            Delta::Copied => FileStatus::Copied,
            _ => FileStatus::Unmodified,
        }
    }
}

/// Represents a changed file in a commit
#[derive(Debug, Clone, Serialize)]
pub struct ChangedFile {
    /// Path to the file
    pub path: String,
    /// Status of the file change
    pub status: FileStatus,
    /// Number of lines added
    pub additions: u32,
    /// Number of lines deleted
    pub deletions: u32,
    /// Original path for renamed files
    pub old_path: Option<String>,
}

/// Represents a file in the working directory with separate staged and unstaged status
#[derive(Debug, Clone, Serialize)]
pub struct WorkingFile {
    /// Path to the file
    pub path: String,
    /// Status in the staging area (index), None if not staged
    pub staged_status: Option<FileStatus>,
    /// Status in the working directory, None if no unstaged changes
    pub unstaged_status: Option<FileStatus>,
    /// Number of staged additions
    pub staged_additions: u32,
    /// Number of staged deletions
    pub staged_deletions: u32,
    /// Number of unstaged additions
    pub unstaged_additions: u32,
    /// Number of unstaged deletions
    pub unstaged_deletions: u32,
    /// Original path for renamed files
    pub old_path: Option<String>,
    /// Which section this entry belongs to: "staged" or "unstaged"
    pub section: String,
}

/// Type of diff line
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum LineType {
    Context,
    Addition,
    Deletion,
}

/// A single line in a diff
#[derive(Debug, Clone, Serialize)]
pub struct DiffLine {
    /// The content of the line (without leading +/- marker)
    pub content: String,
    /// The type of line
    pub line_type: LineType,
    /// Line number in the old file (if applicable)
    pub old_line_no: Option<u32>,
    /// Line number in the new file (if applicable)
    pub new_line_no: Option<u32>,
}

/// A hunk in a diff
#[derive(Debug, Clone, Serialize)]
pub struct DiffHunk {
    /// Starting line in old file
    pub old_start: u32,
    /// Number of lines in old file
    pub old_lines: u32,
    /// Starting line in new file
    pub new_start: u32,
    /// Number of lines in new file
    pub new_lines: u32,
    /// Lines in this hunk
    pub lines: Vec<DiffLine>,
}

/// The complete diff for a file
#[derive(Debug, Clone, Serialize)]
pub struct FileDiff {
    /// Original path (for renames)
    pub old_path: Option<String>,
    /// New/current path
    pub new_path: String,
    /// Hunks in the diff
    pub hunks: Vec<DiffHunk>,
    /// Whether this is a binary file
    pub is_binary: bool,
}

/// File contents for a specific file in a commit (before and after)
#[derive(Debug, Clone, Serialize)]
pub struct FileContents {
    /// Content before the commit (None if file was added)
    pub old_content: Option<String>,
    /// Content after the commit (None if file was deleted)
    pub new_content: Option<String>,
    /// Whether this is a binary file
    pub is_binary: bool,
}

/// Information about a repository
#[derive(Debug, Clone, Serialize)]
pub struct RepoInfo {
    /// Path to the repository
    pub path: String,
    /// Name of the repository (directory name)
    pub name: String,
    /// Current branch name
    pub branch: String,
}

/// Represents a git branch
#[derive(Debug, Clone, Serialize)]
pub struct Branch {
    /// Name of the branch
    pub name: String,
    /// Whether this is the currently checked out branch
    pub is_current: bool,
    /// Whether this is a remote tracking branch
    pub is_remote: bool,
    /// SHA of the tip commit
    pub commit_id: String,
}

/// Represents a git commit with essential metadata
#[derive(Debug, Clone, Serialize)]
pub struct Commit {
    /// The SHA hash of the commit
    pub id: String,
    /// The first line of the commit message
    pub message: String,
    /// The author's name
    pub author: String,
    /// The author's email
    pub email: String,
    /// Unix timestamp of when the commit was authored
    pub timestamp: i64,
    /// Whether this commit has been pushed to the upstream tracking branch
    pub is_pushed: bool,
}

/// Represents a unique commit author
#[derive(Debug, Clone, Serialize)]
pub struct Author {
    /// The author's name
    pub name: String,
    /// The author's email
    pub email: String,
    /// Total number of commits by this author in the current history
    pub commit_count: usize,
    /// Unix timestamp of this author's most recent commit
    pub last_commit_timestamp: i64,
}

/// Lists unique authors from a git repository
pub fn list_authors(repo_path: &str) -> Result<Vec<Author>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut revwalk =
        repo.revwalk()
            .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    revwalk
        .push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;

    let mut authors = std::collections::HashMap::<String, Author>::new();

    for oid_result in revwalk {
        let oid = oid_result.map_err(|e| format!("Failed to get commit oid: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;
        let author = commit.author();
        let email = author.email().unwrap_or("").to_string();
        let timestamp = author.when().seconds();

        authors
            .entry(email.clone())
            .and_modify(|existing| {
                existing.commit_count += 1;
                existing.last_commit_timestamp =
                    existing.last_commit_timestamp.max(timestamp);
            })
            .or_insert_with(|| Author {
                name: author.name().unwrap_or("Unknown").to_string(),
                email,
                commit_count: 1,
                last_commit_timestamp: timestamp,
            });
    }

    let mut authors: Vec<_> = authors.into_values().collect();
    authors.sort_by(|a, b| {
        b.last_commit_timestamp
            .cmp(&a.last_commit_timestamp)
            .then_with(|| b.commit_count.cmp(&a.commit_count))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.email.to_lowercase().cmp(&b.email.to_lowercase()))
    });

    Ok(authors)
}

/// Lists commits from a git repository
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `limit` - Maximum number of commits to return (defaults to 100)
///
/// # Returns
/// A vector of Commit structs or an error message
pub fn list_commits(
    repo_path: &str,
    limit: Option<usize>,
    author_emails: Option<Vec<String>>,
) -> Result<Vec<Commit>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut revwalk =
        repo.revwalk()
            .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    // Start from HEAD
    revwalk
        .push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;

    let limit = limit.unwrap_or(100);
    // Treat empty vec as no filter
    let filter_emails = author_emails.filter(|v| !v.is_empty());

    // Resolve the merge base between HEAD and upstream to determine pushed/unpushed.
    // Using the merge base (instead of the upstream OID directly) handles diverged
    // histories: the merge base is always in the local revwalk, even when the
    // upstream has moved ahead with commits not in local history.
    let pushed_boundary_oid = repo
        .head()
        .ok()
        .filter(|h| h.is_branch())
        .and_then(|head_ref| {
            let head_oid = head_ref.target()?;
            let branch_name = head_ref.shorthand()?.to_string();
            let branch = repo.find_branch(&branch_name, BranchType::Local).ok()?;
            let upstream = branch.upstream().ok()?;
            let upstream_oid = upstream.into_reference().peel_to_commit().ok()?.id();
            repo.merge_base(head_oid, upstream_oid).ok()
        });

    let mut commits = Vec::new();

    // Once we've seen the upstream OID, all subsequent commits in the revwalk
    // are ancestors of upstream and therefore pushed. This avoids calling
    // graph_descendant_of for every commit.
    // No upstream → nothing is pushed (reached_upstream stays false).
    let mut reached_upstream = false;

    for oid_result in revwalk {
        if commits.len() >= limit {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Failed to get commit oid: {}", e))?;

        if !reached_upstream {
            if let Some(boundary) = pushed_boundary_oid {
                if oid == boundary {
                    reached_upstream = true;
                }
            }
        }

        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let author = commit.author();
        let email = author.email().unwrap_or("").to_string();

        // Skip commits that don't match the author filter
        if let Some(ref emails) = filter_emails {
            if !emails.iter().any(|e| e == &email) {
                continue;
            }
        }

        let message = commit
            .message()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();

        commits.push(Commit {
            id: oid.to_string(),
            message,
            author: author.name().unwrap_or("Unknown").to_string(),
            email,
            timestamp: author.when().seconds(),
            is_pushed: reached_upstream,
        });
    }

    Ok(commits)
}

fn resolve_commit_selection_range(
    repo: &Repository,
    commit_ids: &[String],
) -> Result<(git2::Oid, git2::Oid), String> {
    if commit_ids.is_empty() {
        return Err("At least one commit must be selected".to_string());
    }

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;
    revwalk
        .push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;

    let mut commit_indices = std::collections::HashMap::new();

    for (index, oid_result) in revwalk.enumerate() {
        let oid = oid_result.map_err(|e| format!("Failed to get commit oid: {}", e))?;
        commit_indices.insert(oid.to_string(), index);
    }

    let mut selected_indices = Vec::new();

    for commit_id in commit_ids {
        let index = commit_indices.get(commit_id).ok_or_else(|| {
            format!("Unable to find selected commit '{}' in current history", commit_id)
        })?;
        selected_indices.push(*index);
    }

    let min_index = *selected_indices
        .iter()
        .min()
        .ok_or_else(|| "At least one commit must be selected".to_string())?;
    let max_index = *selected_indices
        .iter()
        .max()
        .ok_or_else(|| "At least one commit must be selected".to_string())?;

    let expected_selection_size = max_index - min_index + 1;
    if expected_selection_size != selected_indices.len() {
        return Err("Unable to display diff for multiple non-consecutive commits".to_string());
    }

    let newest_commit = commit_ids
        .iter()
        .min_by_key(|id| commit_indices.get(*id).copied().unwrap_or(usize::MAX))
        .ok_or_else(|| "At least one commit must be selected".to_string())?;
    let oldest_commit = commit_ids
        .iter()
        .max_by_key(|id| commit_indices.get(*id).copied().unwrap_or(0))
        .ok_or_else(|| "At least one commit must be selected".to_string())?;

    let newest_oid = git2::Oid::from_str(newest_commit)
        .map_err(|e| format!("Invalid commit ID '{}': {}", newest_commit, e))?;
    let oldest_oid = git2::Oid::from_str(oldest_commit)
        .map_err(|e| format!("Invalid commit ID '{}': {}", oldest_commit, e))?;

    repo
        .find_commit(newest_oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;
    repo
        .find_commit(oldest_oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    Ok((oldest_oid, newest_oid))
}

/// Gets the list of files changed in a specific commit
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `commit_id` - SHA of the commit to inspect
///
/// # Returns
/// A vector of ChangedFile structs or an error message
pub fn get_commit_files(repo_path: &str, commit_id: &str) -> Result<Vec<ChangedFile>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID '{}': {}", commit_id, e))?;

    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    // Get parent tree (or empty tree for root commit)
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    let mut files: Vec<ChangedFile> = Vec::new();

    // Collect file stats
    let stats = diff
        .stats()
        .map_err(|e| format!("Failed to get diff stats: {}", e))?;
    let _ = stats; // We'll get per-file stats differently

    for delta_idx in 0..diff.deltas().len() {
        let delta = diff.get_delta(delta_idx).expect("Delta should exist");

        let new_file = delta.new_file();
        let old_file = delta.old_file();

        let path = new_file
            .path()
            .or_else(|| old_file.path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let old_path = if delta.status() == Delta::Renamed {
            old_file.path().map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        // Get line stats for this file
        let mut additions = 0u32;
        let mut deletions = 0u32;

        // Use a patch to get accurate line counts
        if let Ok(patch) = git2::Patch::from_diff(&diff, delta_idx) {
            if let Some(patch) = patch {
                let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
                additions = adds as u32;
                deletions = dels as u32;
            }
        }

        files.push(ChangedFile {
            path,
            status: delta.status().into(),
            additions,
            deletions,
            old_path,
        });
    }

    Ok(files)
}

/// Gets the list of files changed across a selected commit range.
///
/// The range uses the oldest selected commit's parent tree as the baseline,
/// and the newest selected commit's tree as the target.
pub fn get_commit_range_files(repo_path: &str, commit_ids: &[String]) -> Result<Vec<ChangedFile>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let (oldest_oid, newest_oid) = resolve_commit_selection_range(&repo, commit_ids)?;

    let newest_commit = repo
        .find_commit(newest_oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;
    let oldest_commit = repo
        .find_commit(oldest_oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let newest_tree = newest_commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let oldest_parent_tree = if oldest_commit.parent_count() > 0 {
        Some(
            oldest_commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(
            oldest_parent_tree.as_ref(),
            Some(&newest_tree),
            Some(&mut diff_opts),
        )
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    let mut files: Vec<ChangedFile> = Vec::new();

    for delta_idx in 0..diff.deltas().len() {
        let delta = diff.get_delta(delta_idx).expect("Delta should exist");

        let new_file = delta.new_file();
        let old_file = delta.old_file();

        let path = new_file
            .path()
            .or_else(|| old_file.path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let old_path = if delta.status() == Delta::Renamed {
            old_file.path().map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        let mut additions = 0u32;
        let mut deletions = 0u32;

        if let Ok(patch) = git2::Patch::from_diff(&diff, delta_idx) {
            if let Some(patch) = patch {
                let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
                additions = adds as u32;
                deletions = dels as u32;
            }
        }

        files.push(ChangedFile {
            path,
            status: delta.status().into(),
            additions,
            deletions,
            old_path,
        });
    }

    Ok(files)
}

/// Gets the diff for a specific file in a commit
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `commit_id` - SHA of the commit
/// * `file_path` - Path to the file to get diff for
///
/// # Returns
/// A FileDiff struct or an error message
pub fn get_file_diff(
    repo_path: &str,
    commit_id: &str,
    file_path: &str,
) -> Result<FileDiff, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID '{}': {}", commit_id, e))?;

    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    // Find the delta for our file
    let delta = diff
        .get_delta(0)
        .ok_or_else(|| format!("File '{}' not found in commit", file_path))?;

    let new_file = delta.new_file();
    let old_file = delta.old_file();

    let new_path = new_file
        .path()
        .or_else(|| old_file.path())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let old_path = if delta.status() == Delta::Renamed || delta.status() == Delta::Copied {
        old_file.path().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };

    // Check if binary
    let is_binary = new_file.is_binary() || old_file.is_binary();

    if is_binary {
        return Ok(FileDiff {
            old_path,
            new_path,
            hunks: Vec::new(),
            is_binary: true,
        });
    }

    // Get patch for detailed diff
    let patch = git2::Patch::from_diff(&diff, 0)
        .map_err(|e| format!("Failed to create patch: {}", e))?
        .ok_or_else(|| "Failed to create patch for file".to_string())?;

    let mut hunks = Vec::new();

    for hunk_idx in 0..patch.num_hunks() {
        let (hunk, _) = patch
            .hunk(hunk_idx)
            .map_err(|e| format!("Failed to get hunk: {}", e))?;

        let mut lines = Vec::new();

        for line_idx in 0..patch.num_lines_in_hunk(hunk_idx).unwrap_or(0) {
            let line = patch
                .line_in_hunk(hunk_idx, line_idx)
                .map_err(|e| format!("Failed to get line: {}", e))?;

            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                _ => LineType::Context,
            };

            let content = String::from_utf8_lossy(line.content()).to_string();

            lines.push(DiffLine {
                content,
                line_type,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
            });
        }

        hunks.push(DiffHunk {
            old_start: hunk.old_start(),
            old_lines: hunk.old_lines(),
            new_start: hunk.new_start(),
            new_lines: hunk.new_lines(),
            lines,
        });
    }

    Ok(FileDiff {
        old_path,
        new_path,
        hunks,
        is_binary: false,
    })
}

/// Gets the full file contents before and after a commit for a specific file
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `commit_id` - SHA of the commit
/// * `file_path` - Path to the file to get contents for
///
/// # Returns
/// A FileContents struct with old and new content, or an error message
pub fn get_file_contents(
    repo_path: &str,
    commit_id: &str,
    file_path: &str,
) -> Result<FileContents, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID '{}': {}", commit_id, e))?;

    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    // Helper to get file content from a tree
    let get_content = |tree: &git2::Tree, path: &str| -> Option<Result<String, String>> {
        match tree.get_path(std::path::Path::new(path)) {
            Ok(entry) => {
                let object = match entry.to_object(&repo) {
                    Ok(obj) => obj,
                    Err(e) => return Some(Err(format!("Failed to get object: {}", e))),
                };
                if let Some(blob) = object.as_blob() {
                    if blob.is_binary() {
                        return Some(Err("Binary file".to_string()));
                    }
                    match std::str::from_utf8(blob.content()) {
                        Ok(s) => Some(Ok(s.to_string())),
                        Err(_) => Some(Err("File is not valid UTF-8".to_string())),
                    }
                } else {
                    Some(Err("Not a blob".to_string()))
                }
            }
            Err(_) => None, // File doesn't exist in this tree
        }
    };

    // Get new content (in the commit)
    let new_result = get_content(&tree, file_path);
    
    // Get old content (in parent, if exists)
    let old_result = parent_tree.as_ref().and_then(|pt| get_content(pt, file_path));

    // Check if either is binary
    let is_binary = matches!(&new_result, Some(Err(e)) if e == "Binary file")
        || matches!(&old_result, Some(Err(e)) if e == "Binary file");

    if is_binary {
        return Ok(FileContents {
            old_content: None,
            new_content: None,
            is_binary: true,
        });
    }

    // Verify the file actually changed in this commit
    if new_result.is_none() && old_result.is_none() {
        return Err(format!("File '{}' not found in commit", file_path));
    }

    let old_content = match old_result {
        Some(Ok(content)) => Some(content),
        Some(Err(e)) if e != "Binary file" => return Err(e),
        _ => None,
    };

    let new_content = match new_result {
        Some(Ok(content)) => Some(content),
        Some(Err(e)) if e != "Binary file" => return Err(e),
        _ => None,
    };

    Ok(FileContents {
        old_content,
        new_content,
        is_binary: false,
    })
}

/// Gets full file contents before and after a selected commit range.
///
/// The old content comes from the parent of the oldest selected commit.
/// The new content comes from the newest selected commit.
pub fn get_commit_range_file_contents(
    repo_path: &str,
    commit_ids: &[String],
    file_path: &str,
) -> Result<FileContents, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let (oldest_oid, newest_oid) = resolve_commit_selection_range(&repo, commit_ids)?;

    let newest_commit = repo
        .find_commit(newest_oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;
    let oldest_commit = repo
        .find_commit(oldest_oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    let newest_tree = newest_commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {}", e))?;

    let oldest_parent_tree = if oldest_commit.parent_count() > 0 {
        Some(
            oldest_commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {}", e))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {}", e))?,
        )
    } else {
        None
    };

    let get_content = |tree: &git2::Tree, path: &str| -> Option<Result<String, String>> {
        match tree.get_path(std::path::Path::new(path)) {
            Ok(entry) => {
                let object = match entry.to_object(&repo) {
                    Ok(obj) => obj,
                    Err(e) => return Some(Err(format!("Failed to get object: {}", e))),
                };
                if let Some(blob) = object.as_blob() {
                    if blob.is_binary() {
                        return Some(Err("Binary file".to_string()));
                    }
                    match std::str::from_utf8(blob.content()) {
                        Ok(s) => Some(Ok(s.to_string())),
                        Err(_) => Some(Err("File is not valid UTF-8".to_string())),
                    }
                } else {
                    Some(Err("Not a blob".to_string()))
                }
            }
            Err(_) => None,
        }
    };

    let new_result = get_content(&newest_tree, file_path);
    let old_result = oldest_parent_tree
        .as_ref()
        .and_then(|parent_tree| get_content(parent_tree, file_path));

    let is_binary = matches!(&new_result, Some(Err(e)) if e == "Binary file")
        || matches!(&old_result, Some(Err(e)) if e == "Binary file");

    if is_binary {
        return Ok(FileContents {
            old_content: None,
            new_content: None,
            is_binary: true,
        });
    }

    if new_result.is_none() && old_result.is_none() {
        return Err(format!("File '{}' not found in selected commit range", file_path));
    }

    let old_content = match old_result {
        Some(Ok(content)) => Some(content),
        Some(Err(e)) if e != "Binary file" => return Err(e),
        _ => None,
    };

    let new_content = match new_result {
        Some(Ok(content)) => Some(content),
        Some(Err(e)) if e != "Binary file" => return Err(e),
        _ => None,
    };

    Ok(FileContents {
        old_content,
        new_content,
        is_binary: false,
    })
}

/// Gets the current branch name for a repository
///
/// # Arguments
/// * `repo_path` - Path to the git repository
///
/// # Returns
/// The branch name or an error message
pub fn get_current_branch(repo_path: &str) -> Result<String, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    if head.is_branch() {
        head.shorthand()
            .map(|s| s.to_string())
            .ok_or_else(|| "Branch name is not valid UTF-8".to_string())
    } else {
        // Detached HEAD - return the commit SHA
        head.target()
            .map(|oid| oid.to_string())
            .ok_or_else(|| "HEAD has no target".to_string())
    }
}

/// Lists all branches in the repository
///
/// # Arguments
/// * `repo_path` - Path to the git repository
///
/// # Returns
/// A vector of Branch structs or an error message
pub fn list_branches(repo_path: &str) -> Result<Vec<Branch>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get current branch name for comparison
    let current_branch = get_current_branch(repo_path).ok();

    let mut branches = Vec::new();

    // Get local branches
    let local_branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| format!("Failed to list branches: {}", e))?;

    for branch_result in local_branches {
        let (branch, _branch_type) =
            branch_result.map_err(|e| format!("Failed to get branch: {}", e))?;

        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .ok_or_else(|| "Branch name is not valid UTF-8".to_string())?
            .to_string();

        let is_current = current_branch.as_ref() == Some(&name);

        // Get the tip commit SHA
        let commit_id = branch
            .get()
            .peel_to_commit()
            .map(|c| c.id().to_string())
            .unwrap_or_default();

        branches.push(Branch {
            name,
            is_current,
            is_remote: false,
            commit_id,
        });
    }

    // Get remote branches
    let remote_branches = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| format!("Failed to list remote branches: {}", e))?;

    for branch_result in remote_branches {
        let (branch, _branch_type) =
            branch_result.map_err(|e| format!("Failed to get branch: {}", e))?;

        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .ok_or_else(|| "Branch name is not valid UTF-8".to_string())?
            .to_string();

        // Get the tip commit SHA
        let commit_id = branch
            .get()
            .peel_to_commit()
            .map(|c| c.id().to_string())
            .unwrap_or_default();

        branches.push(Branch {
            name,
            is_current: false, // Remote branches can't be current
            is_remote: true,
            commit_id,
        });
    }

    // Sort: current branch first, then local branches, then remote
    branches.sort_by(|a, b| {
        if a.is_current != b.is_current {
            return b.is_current.cmp(&a.is_current); // current first
        }
        if a.is_remote != b.is_remote {
            return a.is_remote.cmp(&b.is_remote); // local before remote
        }
        a.name.cmp(&b.name)
    });

    Ok(branches)
}

/// Checks out a branch
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `branch_name` - Name of the branch to checkout
///
/// # Returns
/// Ok(()) on success, or an error message
pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Check for uncommitted changes that would be overwritten
    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("Failed to get status: {}", e))?;

    let has_changes = statuses.iter().any(|entry| {
        let status = entry.status();
        // Check for modifications in index or workdir that could conflict
        status.is_wt_modified()
            || status.is_wt_deleted()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_index_new()
    });

    if has_changes {
        return Err(
            "Cannot switch branches: you have uncommitted changes that would be overwritten"
                .to_string(),
        );
    }

    // Find the branch
    let branch = repo
        .find_branch(branch_name, BranchType::Local)
        .map_err(|e| format!("Branch '{}' not found: {}", branch_name, e))?;

    let reference = branch.into_reference();
    let refname = reference
        .name()
        .ok_or_else(|| "Branch reference name is not valid UTF-8".to_string())?;

    // Set HEAD to point to the branch
    repo.set_head(refname)
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    // Checkout the tree (update working directory)
    let tree = reference
        .peel_to_tree()
        .map_err(|e| format!("Failed to get tree: {}", e))?;

    let mut checkout_opts = CheckoutBuilder::new();
    checkout_opts.force(); // Force checkout to update working directory

    repo.checkout_tree(tree.as_object(), Some(&mut checkout_opts))
        .map_err(|e| format!("Failed to checkout: {}", e))?;

    Ok(())
}

/// Validates that a path is a git repository and returns info about it
///
/// # Arguments
/// * `path` - Path to validate
///
/// # Returns
/// A RepoInfo struct or an error message
pub fn validate_repo(path: &str) -> Result<RepoInfo, String> {
    let repo = Repository::open(path).map_err(|e| format!("Not a valid git repository: {}", e))?;

    // Get repository root path
    let repo_path = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory (bare repo)".to_string())?
        .to_string_lossy()
        .to_string();

    // Get directory name
    let name = std::path::Path::new(&repo_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Get current branch
    let branch = get_current_branch(path)?;

    Ok(RepoInfo {
        path: repo_path,
        name,
        branch,
    })
}

/// Gets the list of files changed in the working directory (uncommitted changes)
///
/// # Arguments
/// * `repo_path` - Path to the git repository
///
/// # Returns
/// A vector of ChangedFile structs representing working directory changes
pub fn get_working_changes(repo_path: &str) -> Result<Vec<ChangedFile>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("Failed to get statuses: {}", e))?;

    let mut files: Vec<ChangedFile> = Vec::new();

    for entry in statuses.iter() {
        let status = entry.status();

        // Skip files that are unchanged
        if status.is_empty() {
            continue;
        }

        let path = entry
            .path()
            .map(|p| p.to_string())
            .unwrap_or_default();

        // Determine the file status
        // We combine index (staged) and worktree (unstaged) status since we're showing all changes
        let file_status = if status.is_wt_new() || status.is_index_new() {
            if status.is_wt_new() && !status.is_index_new() {
                FileStatus::Untracked
            } else {
                FileStatus::Added
            }
        } else if status.is_wt_deleted() || status.is_index_deleted() {
            FileStatus::Deleted
        } else if status.is_wt_modified() || status.is_index_modified() {
            FileStatus::Modified
        } else if status.is_wt_renamed() || status.is_index_renamed() {
            FileStatus::Renamed
        } else {
            continue; // Skip other statuses (ignored, etc.)
        };

        // Get line stats by creating a diff
        let mut additions = 0u32;
        let mut deletions = 0u32;

        // Try to get line stats from diff to HEAD
        if let Ok(head) = repo.head() {
            if let Ok(head_commit) = head.peel_to_commit() {
                if let Ok(head_tree) = head_commit.tree() {
                    let mut diff_opts = DiffOptions::new();
                    diff_opts.pathspec(&path);
                    diff_opts.include_untracked(true);

                    if let Ok(diff) = repo.diff_tree_to_workdir_with_index(
                        Some(&head_tree),
                        Some(&mut diff_opts),
                    ) {
                        if let Ok(stats) = diff.stats() {
                            additions = stats.insertions() as u32;
                            deletions = stats.deletions() as u32;
                        }
                    }
                }
            }
        }

        files.push(ChangedFile {
            path,
            status: file_status,
            additions,
            deletions,
            old_path: None, // TODO: Handle renames if needed
        });
    }

    Ok(files)
}

/// Gets the list of files changed in the working directory, split by staged/unstaged
///
/// # Arguments
/// * `repo_path` - Path to the git repository
///
/// # Returns
/// A vector of WorkingFile structs, where each file can appear up to twice:
/// once for staged changes and once for unstaged changes
pub fn get_working_changes_ex(repo_path: &str) -> Result<Vec<WorkingFile>, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("Failed to get statuses: {}", e))?;

    let mut files: Vec<WorkingFile> = Vec::new();

    // Get HEAD tree for diff calculations
    let head_tree = match repo.head() {
        Ok(head) => head
            .peel_to_commit()
            .ok()
            .and_then(|c| c.tree().ok()),
        Err(_) => None,
    };

    for entry in statuses.iter() {
        let status = entry.status();

        // Skip files that are unchanged
        if status.is_empty() {
            continue;
        }

        let path = entry
            .path()
            .map(|p| p.to_string())
            .unwrap_or_default();

        // Determine staged (index) status
        let staged_status = if status.is_index_new() {
            Some(FileStatus::Added)
        } else if status.is_index_deleted() {
            Some(FileStatus::Deleted)
        } else if status.is_index_modified() {
            Some(FileStatus::Modified)
        } else if status.is_index_renamed() {
            Some(FileStatus::Renamed)
        } else {
            None
        };

        // Determine unstaged (workdir) status
        let unstaged_status = if status.is_wt_new() {
            Some(FileStatus::Untracked)
        } else if status.is_wt_deleted() {
            Some(FileStatus::Deleted)
        } else if status.is_wt_modified() {
            Some(FileStatus::Modified)
        } else if status.is_wt_renamed() {
            Some(FileStatus::Renamed)
        } else {
            None
        };

        // Calculate line stats for staged changes (HEAD -> index)
        let (staged_additions, staged_deletions) = if staged_status.is_some() {
            if let Some(ref head) = head_tree {
                let mut diff_opts = DiffOptions::new();
                diff_opts.pathspec(&path);

                if let Ok(diff) = repo.diff_tree_to_index(Some(head), None, Some(&mut diff_opts)) {
                    if let Ok(stats) = diff.stats() {
                        (stats.insertions() as u32, stats.deletions() as u32)
                    } else {
                        (0, 0)
                    }
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        // Calculate line stats for unstaged changes (index -> workdir)
        let (unstaged_additions, unstaged_deletions) = if unstaged_status.is_some() {
            let mut diff_opts = DiffOptions::new();
            diff_opts.pathspec(&path);
            diff_opts.include_untracked(true);

            if let Ok(diff) = repo.diff_index_to_workdir(None, Some(&mut diff_opts)) {
                if let Ok(stats) = diff.stats() {
                    (stats.insertions() as u32, stats.deletions() as u32)
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        // Create entry for staged changes if present
        if staged_status.is_some() {
            files.push(WorkingFile {
                path: path.clone(),
                staged_status,
                unstaged_status: None,
                staged_additions,
                staged_deletions,
                unstaged_additions: 0,
                unstaged_deletions: 0,
                old_path: None,
                section: "staged".to_string(),
            });
        }

        // Create entry for unstaged changes if present
        if unstaged_status.is_some() {
            files.push(WorkingFile {
                path,
                staged_status: None,
                unstaged_status,
                staged_additions: 0,
                staged_deletions: 0,
                unstaged_additions,
                unstaged_deletions,
                old_path: None,
                section: "unstaged".to_string(),
            });
        }
    }

    Ok(files)
}

/// Gets the diff for a specific file in the working directory (vs HEAD)
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Path to the file to get diff for
///
/// # Returns
/// A FileDiff struct or an error message
pub fn get_working_file_diff(repo_path: &str, file_path: &str) -> Result<FileDiff, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get HEAD tree (if it exists)
    let head_tree = match repo.head() {
        Ok(head) => Some(
            head.peel_to_tree()
                .map_err(|e| format!("Failed to get HEAD tree: {}", e))?,
        ),
        Err(_) => None, // No commits yet
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);
    diff_opts.include_untracked(true);

    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    // Check if file exists in diff
    if diff.deltas().len() == 0 {
        return Err(format!("File '{}' has no changes", file_path));
    }

    let delta = diff.get_delta(0).expect("Delta should exist");

    let new_file = delta.new_file();
    let old_file = delta.old_file();

    let new_path = new_file
        .path()
        .or_else(|| old_file.path())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let old_path = if delta.status() == Delta::Renamed || delta.status() == Delta::Copied {
        old_file.path().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };

    // Check if binary
    let is_binary = new_file.is_binary() || old_file.is_binary();

    if is_binary {
        return Ok(FileDiff {
            old_path,
            new_path,
            hunks: Vec::new(),
            is_binary: true,
        });
    }

    // Get patch for detailed diff
    let patch = git2::Patch::from_diff(&diff, 0)
        .map_err(|e| format!("Failed to create patch: {}", e))?
        .ok_or_else(|| "Failed to create patch for file".to_string())?;

    let mut hunks = Vec::new();

    for hunk_idx in 0..patch.num_hunks() {
        let (hunk, _) = patch
            .hunk(hunk_idx)
            .map_err(|e| format!("Failed to get hunk: {}", e))?;

        let mut lines = Vec::new();

        for line_idx in 0..patch.num_lines_in_hunk(hunk_idx).unwrap_or(0) {
            let line = patch
                .line_in_hunk(hunk_idx, line_idx)
                .map_err(|e| format!("Failed to get line: {}", e))?;

            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                _ => LineType::Context,
            };

            let content = String::from_utf8_lossy(line.content()).to_string();

            lines.push(DiffLine {
                content,
                line_type,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
            });
        }

        hunks.push(DiffHunk {
            old_start: hunk.old_start(),
            old_lines: hunk.old_lines(),
            new_start: hunk.new_start(),
            new_lines: hunk.new_lines(),
            lines,
        });
    }

    Ok(FileDiff {
        old_path,
        new_path,
        hunks,
        is_binary: false,
    })
}

/// Gets the diff for staged changes of a file (index vs HEAD)
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Path to the file to get diff for
///
/// # Returns
/// A FileDiff struct showing staged changes, or an error if file has no staged changes
pub fn get_staged_file_diff(repo_path: &str, file_path: &str) -> Result<FileDiff, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get HEAD tree (if it exists)
    let head_tree = match repo.head() {
        Ok(head) => Some(
            head.peel_to_tree()
                .map_err(|e| format!("Failed to get HEAD tree: {}", e))?,
        ),
        Err(_) => None, // No commits yet
    };

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);

    // Diff HEAD -> index (staged changes only)
    let diff = repo
        .diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    // Check if file exists in diff
    if diff.deltas().len() == 0 {
        return Err(format!("File '{}' has no staged changes", file_path));
    }

    let delta = diff.get_delta(0).expect("Delta should exist");

    // Check if file actually has changes (not just in index with no diff)
    if delta.status() == Delta::Unmodified {
        return Err(format!("File '{}' has no staged changes", file_path));
    }

    let new_file = delta.new_file();
    let old_file = delta.old_file();

    let new_path = new_file
        .path()
        .or_else(|| old_file.path())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let old_path = if delta.status() == Delta::Renamed || delta.status() == Delta::Copied {
        old_file.path().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };

    // Check if binary
    let is_binary = new_file.is_binary() || old_file.is_binary();

    if is_binary {
        return Ok(FileDiff {
            old_path,
            new_path,
            hunks: Vec::new(),
            is_binary: true,
        });
    }

    // Get patch for detailed diff
    let patch = git2::Patch::from_diff(&diff, 0)
        .map_err(|e| format!("Failed to create patch: {}", e))?
        .ok_or_else(|| "Failed to create patch for file".to_string())?;

    let mut hunks = Vec::new();

    for hunk_idx in 0..patch.num_hunks() {
        let (hunk, _) = patch
            .hunk(hunk_idx)
            .map_err(|e| format!("Failed to get hunk: {}", e))?;

        let mut lines = Vec::new();

        for line_idx in 0..patch.num_lines_in_hunk(hunk_idx).unwrap_or(0) {
            let line = patch
                .line_in_hunk(hunk_idx, line_idx)
                .map_err(|e| format!("Failed to get line: {}", e))?;

            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                _ => LineType::Context,
            };

            let content = String::from_utf8_lossy(line.content()).to_string();

            lines.push(DiffLine {
                content,
                line_type,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
            });
        }

        hunks.push(DiffHunk {
            old_start: hunk.old_start(),
            old_lines: hunk.old_lines(),
            new_start: hunk.new_start(),
            new_lines: hunk.new_lines(),
            lines,
        });
    }

    Ok(FileDiff {
        old_path,
        new_path,
        hunks,
        is_binary: false,
    })
}

/// Gets the diff for unstaged changes of a file (workdir vs index)
/// Falls back to workdir vs HEAD if file has no staged changes
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Path to the file to get diff for
///
/// # Returns
/// A FileDiff struct showing unstaged changes
pub fn get_unstaged_file_diff(repo_path: &str, file_path: &str) -> Result<FileDiff, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);
    diff_opts.include_untracked(true);

    // Diff index -> workdir (unstaged changes)
    let diff = repo
        .diff_index_to_workdir(None, Some(&mut diff_opts))
        .map_err(|e| format!("Failed to create diff: {}", e))?;

    // Check if file exists in diff
    if diff.deltas().len() == 0 {
        return Err(format!("File '{}' has no unstaged changes", file_path));
    }

    let delta = diff.get_delta(0).expect("Delta should exist");

    let new_file = delta.new_file();
    let old_file = delta.old_file();

    let new_path = new_file
        .path()
        .or_else(|| old_file.path())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let old_path = if delta.status() == Delta::Renamed || delta.status() == Delta::Copied {
        old_file.path().map(|p| p.to_string_lossy().to_string())
    } else {
        None
    };

    // Check if binary
    let is_binary = new_file.is_binary() || old_file.is_binary();

    if is_binary {
        return Ok(FileDiff {
            old_path,
            new_path,
            hunks: Vec::new(),
            is_binary: true,
        });
    }

    // Get patch for detailed diff
    let patch = git2::Patch::from_diff(&diff, 0)
        .map_err(|e| format!("Failed to create patch: {}", e))?
        .ok_or_else(|| "Failed to create patch for file".to_string())?;

    let mut hunks = Vec::new();

    for hunk_idx in 0..patch.num_hunks() {
        let (hunk, _) = patch
            .hunk(hunk_idx)
            .map_err(|e| format!("Failed to get hunk: {}", e))?;

        let mut lines = Vec::new();

        for line_idx in 0..patch.num_lines_in_hunk(hunk_idx).unwrap_or(0) {
            let line = patch
                .line_in_hunk(hunk_idx, line_idx)
                .map_err(|e| format!("Failed to get line: {}", e))?;

            let line_type = match line.origin() {
                '+' => LineType::Addition,
                '-' => LineType::Deletion,
                _ => LineType::Context,
            };

            let content = String::from_utf8_lossy(line.content()).to_string();

            lines.push(DiffLine {
                content,
                line_type,
                old_line_no: line.old_lineno(),
                new_line_no: line.new_lineno(),
            });
        }

        hunks.push(DiffHunk {
            old_start: hunk.old_start(),
            old_lines: hunk.old_lines(),
            new_start: hunk.new_start(),
            new_lines: hunk.new_lines(),
            lines,
        });
    }

    Ok(FileDiff {
        old_path,
        new_path,
        hunks,
        is_binary: false,
    })
}

/// Gets the full file contents for a working directory change (vs HEAD)
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Path to the file to get contents for
///
/// # Returns
/// A FileContents struct with old (HEAD) and new (working dir) content
pub fn get_working_file_contents(repo_path: &str, file_path: &str) -> Result<FileContents, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get old content from HEAD (if it exists)
    let old_content = match repo.head() {
        Ok(head) => {
            let tree = head
                .peel_to_tree()
                .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

            match tree.get_path(std::path::Path::new(file_path)) {
                Ok(entry) => {
                    let object = entry
                        .to_object(&repo)
                        .map_err(|e| format!("Failed to get object: {}", e))?;

                    if let Some(blob) = object.as_blob() {
                        if blob.is_binary() {
                            return Ok(FileContents {
                                old_content: None,
                                new_content: None,
                                is_binary: true,
                            });
                        }
                        match std::str::from_utf8(blob.content()) {
                            Ok(s) => Some(s.to_string()),
                            Err(_) => {
                                return Err("File is not valid UTF-8".to_string());
                            }
                        }
                    } else {
                        return Err("Not a blob".to_string());
                    }
                }
                Err(_) => None, // File doesn't exist in HEAD (new file)
            }
        }
        Err(_) => None, // No HEAD (empty repo)
    };

    // Get new content from working directory
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory".to_string())?;

    let file_full_path = workdir.join(file_path);

    let new_content = if file_full_path.exists() {
        let content = std::fs::read(&file_full_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Check if binary (contains null bytes in first 8000 bytes)
        let check_len = std::cmp::min(content.len(), 8000);
        if content[..check_len].contains(&0) {
            return Ok(FileContents {
                old_content: None,
                new_content: None,
                is_binary: true,
            });
        }

        match String::from_utf8(content) {
            Ok(s) => Some(s),
            Err(_) => return Err("File is not valid UTF-8".to_string()),
        }
    } else {
        None // File was deleted
    };

    // Verify there's actually a change
    if old_content.is_none() && new_content.is_none() {
        return Err(format!("File '{}' not found", file_path));
    }

    Ok(FileContents {
        old_content,
        new_content,
        is_binary: false,
    })
}

/// Gets the file contents for a staged file (HEAD vs index/staging area)
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Path to the file to get contents for
///
/// # Returns
/// A FileContents struct with old (HEAD) and new (staged/index) content
pub fn get_staged_file_contents(repo_path: &str, file_path: &str) -> Result<FileContents, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get old content from HEAD (if it exists)
    let old_content = match repo.head() {
        Ok(head) => {
            let tree = head
                .peel_to_tree()
                .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

            match tree.get_path(std::path::Path::new(file_path)) {
                Ok(entry) => {
                    let object = entry
                        .to_object(&repo)
                        .map_err(|e| format!("Failed to get object: {}", e))?;

                    if let Some(blob) = object.as_blob() {
                        if blob.is_binary() {
                            return Ok(FileContents {
                                old_content: None,
                                new_content: None,
                                is_binary: true,
                            });
                        }
                        match std::str::from_utf8(blob.content()) {
                            Ok(s) => Some(s.to_string()),
                            Err(_) => {
                                return Err("File is not valid UTF-8".to_string());
                            }
                        }
                    } else {
                        return Err("Not a blob".to_string());
                    }
                }
                Err(_) => None, // File doesn't exist in HEAD (new file)
            }
        }
        Err(_) => None, // No HEAD (empty repo)
    };

    // Get new content from index (staged)
    let new_content = match repo.index() {
        Ok(index) => {
            match index.get_path(std::path::Path::new(file_path), 0) {
                Some(entry) => {
                    match repo.find_blob(entry.id) {
                        Ok(blob) => {
                            if blob.is_binary() {
                                return Ok(FileContents {
                                    old_content: None,
                                    new_content: None,
                                    is_binary: true,
                                });
                            }
                            match std::str::from_utf8(blob.content()) {
                                Ok(s) => Some(s.to_string()),
                                Err(_) => return Err("File is not valid UTF-8".to_string()),
                            }
                        }
                        Err(_) => None,
                    }
                }
                None => None, // File not in index
            }
        }
        Err(_) => None,
    };

    // Verify there's actually a change
    if old_content.is_none() && new_content.is_none() {
        return Err(format!("File '{}' not found in HEAD or index", file_path));
    }

    Ok(FileContents {
        old_content,
        new_content,
        is_binary: false,
    })
}

/// Gets the file contents for an unstaged file (index vs working directory)
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Path to the file to get contents for
///
/// # Returns
/// A FileContents struct with old (index/staged) and new (working dir) content
pub fn get_unstaged_file_contents(repo_path: &str, file_path: &str) -> Result<FileContents, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get old content from index (staged)
    let old_content = match repo.index() {
        Ok(index) => {
            match index.get_path(std::path::Path::new(file_path), 0) {
                Some(entry) => {
                    match repo.find_blob(entry.id) {
                        Ok(blob) => {
                            if blob.is_binary() {
                                return Ok(FileContents {
                                    old_content: None,
                                    new_content: None,
                                    is_binary: true,
                                });
                            }
                            match std::str::from_utf8(blob.content()) {
                                Ok(s) => Some(s.to_string()),
                                Err(_) => return Err("File is not valid UTF-8".to_string()),
                            }
                        }
                        Err(_) => None,
                    }
                }
                None => None, // File not in index (check HEAD as fallback)
            }
        }
        Err(_) => None,
    };

    // If not in index, try HEAD (file not staged)
    let old_content = if old_content.is_none() {
        match repo.head() {
            Ok(head) => {
                let tree = head.peel_to_tree()
                    .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;
                
                match tree.get_path(std::path::Path::new(file_path)) {
                    Ok(entry) => {
                        let object = entry.to_object(&repo)
                            .map_err(|e| format!("Failed to get object: {}", e))?;
                        
                        if let Some(blob) = object.as_blob() {
                            if blob.is_binary() {
                                return Ok(FileContents {
                                    old_content: None,
                                    new_content: None,
                                    is_binary: true,
                                });
                            }
                            match std::str::from_utf8(blob.content()) {
                                Ok(s) => Some(s.to_string()),
                                Err(_) => return Err("File is not valid UTF-8".to_string()),
                            }
                        } else {
                            None
                        }
                    }
                    Err(_) => None,
                }
            }
            Err(_) => None,
        }
    } else {
        old_content
    };

    // Get new content from working directory
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory".to_string())?;

    let file_full_path = workdir.join(file_path);

    let new_content = if file_full_path.exists() {
        let content = std::fs::read(&file_full_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Check if binary (contains null bytes in first 8000 bytes)
        let check_len = std::cmp::min(content.len(), 8000);
        if content[..check_len].contains(&0) {
            return Ok(FileContents {
                old_content: None,
                new_content: None,
                is_binary: true,
            });
        }

        match String::from_utf8(content) {
            Ok(s) => Some(s),
            Err(_) => return Err("File is not valid UTF-8".to_string()),
        }
    } else {
        None // File was deleted
    };

    // Verify there's actually a change
    if old_content.is_none() && new_content.is_none() {
        return Err(format!("File '{}' not found", file_path));
    }

    Ok(FileContents {
        old_content,
        new_content,
        is_binary: false,
    })
}

/// Unstages a file by resetting its index entry to match HEAD.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Relative path to the file within the repository
///
/// # Returns
/// Ok(()) on success, or an error message
pub fn unstage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    // Get HEAD tree to reset the file to
    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
    let head_tree = head_commit
        .tree()
        .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

    // Check if file exists in HEAD
    let path = std::path::Path::new(file_path);
    match head_tree.get_path(path) {
        Ok(entry) => {
            // File exists in HEAD - restore index entry to HEAD version
            let blob = repo
                .find_blob(entry.id())
                .map_err(|e| format!("Failed to find blob: {}", e))?;

            let index_entry = git2::IndexEntry {
                ctime: git2::IndexTime::new(0, 0),
                mtime: git2::IndexTime::new(0, 0),
                dev: 0,
                ino: 0,
                mode: entry.filemode() as u32,
                uid: 0,
                gid: 0,
                file_size: blob.size() as u32,
                id: entry.id(),
                flags: 0,
                flags_extended: 0,
                path: file_path.as_bytes().to_vec(),
            };

            index
                .add(&index_entry)
                .map_err(|e| format!("Failed to reset index entry: {}", e))?;
        }
        Err(_) => {
            // File doesn't exist in HEAD - remove from index (was a new file)
            index
                .remove_path(path)
                .map_err(|e| format!("Failed to remove from index: {}", e))?;
        }
    }

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Discards changes to a file in the working directory.
/// For tracked files: restores the file content from the index (or HEAD if not staged).
/// For untracked files: deletes the file from the working directory.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Relative path to the file within the repository
///
/// # Returns
/// Ok(()) on success, or an error message
pub fn discard_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    // Check the status of the file
    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("Failed to get statuses: {}", e))?;

    let file_status = statuses.iter().find(|entry| {
        entry
            .path()
            .map(|p| p == file_path)
            .unwrap_or(false)
    });

    let status = file_status
        .map(|e| e.status())
        .ok_or_else(|| format!("File '{}' has no changes to discard", file_path))?;

    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory".to_string())?;
    let full_path = workdir.join(file_path);

    // Handle untracked files - just delete them
    if status.is_wt_new() && !status.is_index_new() {
        if full_path.exists() {
            std::fs::remove_file(&full_path)
                .map_err(|e| format!("Failed to delete file: {}", e))?;
        }
        return Ok(());
    }

    // For tracked files, checkout from index (which reflects staged state or HEAD)
    let mut checkout_opts = CheckoutBuilder::new();
    checkout_opts.force();
    checkout_opts.path(file_path);

    repo.checkout_index(None, Some(&mut checkout_opts))
        .map_err(|e| format!("Failed to discard changes: {}", e))?;

    Ok(())
}

/// Ahead/behind counts relative to the upstream tracking branch
#[derive(Debug, Clone, Serialize)]
pub struct AheadBehind {
    /// Number of local commits not yet pushed to the upstream
    pub ahead: usize,
    /// Number of upstream commits not yet merged locally
    pub behind: usize,
}

/// Stages a single file (equivalent to `git add <file>`).
///
/// Handles modified, new (untracked), and deleted files.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `file_path` - Relative path to the file within the repository
pub fn stage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    let path = std::path::Path::new(file_path);
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory".to_string())?;
    let full_path = workdir.join(path);

    if full_path.exists() {
        // File exists on disk — add it (handles both new and modified)
        index
            .add_path(path)
            .map_err(|e| format!("Failed to stage file: {}", e))?;
    } else {
        // File was deleted — remove from index
        index
            .remove_path(path)
            .map_err(|e| format!("Failed to stage deleted file: {}", e))?;
    }

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Stages all working changes (equivalent to `git add -A`).
///
/// Stages modified, new, and deleted files.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
pub fn stage_all(repo_path: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage all files: {}", e))?;

    // add_all with DEFAULT doesn't handle deletions — remove index entries
    // for files that no longer exist on disk
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory".to_string())?;

    let entries: Vec<_> = index
        .iter()
        .filter_map(|entry| {
            let path_bytes = &entry.path;
            let path_str = String::from_utf8_lossy(path_bytes).to_string();
            if !workdir.join(&path_str).exists() {
                Some(path_str)
            } else {
                None
            }
        })
        .collect();

    for path_str in entries {
        index
            .remove_path(std::path::Path::new(&path_str))
            .map_err(|e| format!("Failed to stage deletion of '{}': {}", path_str, e))?;
    }

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Unstages all staged changes (equivalent to `git reset HEAD`).
///
/// Resets the index to match HEAD, leaving working directory changes intact.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
pub fn unstage_all(repo_path: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    let head_object = head_commit
        .as_object();

    repo.reset(head_object, git2::ResetType::Mixed, None)
        .map_err(|e| format!("Failed to unstage all: {}", e))?;

    Ok(())
}

/// Creates a commit from the currently staged changes.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `message` - Full commit message (summary + optional body)
///
/// # Returns
/// Ok(()) on success, or an error if there are no staged changes or the commit fails
pub fn create_commit(repo_path: &str, message: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    // Check that there are staged changes by comparing index tree to HEAD tree
    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;
    let head_tree = head_commit
        .tree()
        .map_err(|e| format!("Failed to get HEAD tree: {}", e))?;

    let index_tree_oid = index
        .write_tree()
        .map_err(|e| format!("Failed to write index tree: {}", e))?;
    let index_tree = repo
        .find_tree(index_tree_oid)
        .map_err(|e| format!("Failed to find index tree: {}", e))?;

    // If index tree matches HEAD tree, there are no staged changes
    let diff = repo
        .diff_tree_to_tree(Some(&head_tree), Some(&index_tree), None)
        .map_err(|e| format!("Failed to diff trees: {}", e))?;
    if diff.deltas().len() == 0 {
        return Err("No staged changes to commit".to_string());
    }

    let signature = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &index_tree,
        &[&head_commit],
    )
    .map_err(|e| format!("Failed to create commit: {}", e))?;

    Ok(())
}

/// Gets ahead/behind counts for the current branch vs its upstream tracking branch.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
///
/// # Returns
/// An AheadBehind struct, or an error if the branch has no upstream
pub fn get_ahead_behind(repo_path: &str) -> Result<AheadBehind, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    if !head.is_branch() {
        return Err("HEAD is detached".to_string());
    }

    let branch_name = head
        .shorthand()
        .ok_or_else(|| "Branch name is not valid UTF-8".to_string())?;

    let branch = repo
        .find_branch(branch_name, BranchType::Local)
        .map_err(|e| format!("Failed to find branch: {}", e))?;

    let upstream = branch
        .upstream()
        .map_err(|_| "No upstream tracking branch configured".to_string())?;

    let local_oid = head
        .target()
        .ok_or_else(|| "HEAD has no target".to_string())?;

    let upstream_oid = upstream
        .get()
        .target()
        .ok_or_else(|| "Upstream has no target".to_string())?;

    let (ahead, behind) = repo
        .graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|e| format!("Failed to compute ahead/behind: {}", e))?;

    Ok(AheadBehind { ahead, behind })
}

/// Gets the full commit message (summary + body) for a specific commit.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `commit_id` - SHA of the commit
///
/// # Returns
/// The full commit message string, or an error message
pub fn get_commit_message(repo_path: &str, commit_id: &str) -> Result<String, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID '{}': {}", commit_id, e))?;

    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Failed to find commit: {}", e))?;

    Ok(commit.message().unwrap_or("").to_string())
}

/// Rewords a commit message for a commit in the current branch.
///
/// For the HEAD commit, this performs an amend. For older commits, it replays
/// all commits from the target to HEAD with the updated message.
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `commit_id` - SHA of the commit to reword
/// * `new_message` - The new commit message
///
/// # Returns
/// Ok(()) on success, or an error message
pub fn reword_commit(repo_path: &str, commit_id: &str, new_message: &str) -> Result<(), String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let target_oid = git2::Oid::from_str(commit_id)
        .map_err(|e| format!("Invalid commit ID '{}': {}", commit_id, e))?;

    let head = repo
        .head()
        .map_err(|e| format!("Failed to get HEAD: {}", e))?;

    if !head.is_branch() {
        return Err("Cannot reword commits in detached HEAD state".to_string());
    }

    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    // If it's HEAD, just amend
    if head_commit.id() == target_oid {
        head_commit
            .amend(Some("HEAD"), None, None, None, Some(new_message), None)
            .map_err(|e| format!("Failed to amend commit: {}", e))?;
        return Ok(());
    }

    // Collect commits from HEAD to target (inclusive), walking backwards
    let mut commits_to_replay = Vec::new();
    let mut current = head_commit;
    loop {
        commits_to_replay.push(current.clone());
        if current.id() == target_oid {
            break;
        }
        if current.parent_count() == 0 {
            return Err(format!(
                "Commit '{}' not found in current branch history",
                commit_id
            ));
        }
        current = current
            .parent(0)
            .map_err(|e| format!("Failed to get parent commit: {}", e))?;
    }

    // Reverse so we replay from target (oldest) to HEAD (newest)
    commits_to_replay.reverse();

    // Determine the base parent (target's parent, if any)
    let target_commit = &commits_to_replay[0];
    let base_parent_id = if target_commit.parent_count() > 0 {
        Some(
            target_commit
                .parent_id(0)
                .map_err(|e| format!("Failed to get parent ID: {}", e))?,
        )
    } else {
        None
    };

    // Replay each commit with the appropriate message
    let mut parent_oid = base_parent_id;

    for commit in &commits_to_replay {
        let message = if commit.id() == target_oid {
            new_message
        } else {
            commit.message().unwrap_or("")
        };

        let parents = match parent_oid {
            Some(pid) => {
                let parent = repo
                    .find_commit(pid)
                    .map_err(|e| format!("Failed to find parent commit: {}", e))?;
                vec![parent]
            }
            None => vec![],
        };
        let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

        let tree = commit
            .tree()
            .map_err(|e| format!("Failed to get commit tree: {}", e))?;

        let new_oid = repo
            .commit(
                None, // Don't update any ref yet
                &commit.author(),
                &commit.committer(),
                message,
                &tree,
                &parent_refs,
            )
            .map_err(|e| format!("Failed to create commit: {}", e))?;

        parent_oid = Some(new_oid);
    }

    // Update the branch ref to point to the new HEAD
    let final_oid = parent_oid.expect("Should have at least one commit");
    let branch_ref = head
        .name()
        .ok_or_else(|| "HEAD is not a named reference".to_string())?;

    repo.reference(branch_ref, final_oid, true, "reword commit")
        .map_err(|e| format!("Failed to update branch reference: {}", e))?;

    Ok(())
}

/// Gets the URL of the "origin" remote for a repository
///
/// # Arguments
/// * `repo_path` - Path to the git repository
///
/// # Returns
/// The remote URL string, or an error if no origin remote is configured
pub fn get_remote_url(repo_path: &str) -> Result<String, String> {
    let repo =
        Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let remote = repo
        .find_remote("origin")
        .map_err(|_| "No 'origin' remote configured".to_string())?;

    remote
        .url()
        .map(|url| url.to_string())
        .ok_or_else(|| "Remote URL is not valid UTF-8".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::TempDir;

    fn create_test_repo() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path();

        // Initialize git repo
        Command::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .expect("Failed to init git repo");

        // Configure git user for the test repo
        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(path)
            .output()
            .expect("Failed to set git email");

        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(path)
            .output()
            .expect("Failed to set git name");

        // Create initial commit
        std::fs::write(path.join("README.md"), "# Test").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        // Create second commit
        std::fs::write(path.join("file.txt"), "content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Add file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        temp_dir
    }

    #[test]
    fn test_list_commits_returns_commits() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");

        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].message, "Add file");
        assert_eq!(commits[1].message, "Initial commit");
    }

    #[test]
    fn test_list_commits_respects_limit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, Some(1), None).expect("Should return commits");

        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, "Add file");
    }

    #[test]
    fn test_list_commits_includes_author_info() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");

        assert_eq!(commits[0].author, "Test User");
        assert_eq!(commits[0].email, "test@example.com");
    }

    #[test]
    fn test_list_commits_invalid_path() {
        let result = list_commits("/nonexistent/path", None, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open repository"));
    }

    #[test]
    fn test_list_commits_not_a_repo() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path().to_str().unwrap();

        let result = list_commits(path, None, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_list_commits_filters_by_author_email() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Add a commit by a different author
        Command::new("git")
            .args(["config", "user.email", "alice@example.com"])
            .current_dir(path)
            .output()
            .expect("Failed to set git email");
        Command::new("git")
            .args(["config", "user.name", "Alice"])
            .current_dir(path)
            .output()
            .expect("Failed to set git name");
        std::fs::write(path.join("alice.txt"), "alice's file").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Alice's commit"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        let path_str = path.to_str().unwrap();

        // Without filter: 3 commits (Alice + 2 from Test User)
        let all = list_commits(path_str, None, None).expect("Should return commits");
        assert_eq!(all.len(), 3);

        // Filter to alice only
        let alice_only = list_commits(
            path_str,
            None,
            Some(vec!["alice@example.com".to_string()]),
        )
        .expect("Should return commits");
        assert_eq!(alice_only.len(), 1);
        assert_eq!(alice_only[0].message, "Alice's commit");
        assert_eq!(alice_only[0].email, "alice@example.com");

        // Filter to test@example.com only
        let test_only = list_commits(
            path_str,
            None,
            Some(vec!["test@example.com".to_string()]),
        )
        .expect("Should return commits");
        assert_eq!(test_only.len(), 2);
    }

    #[test]
    fn test_list_commits_author_filter_respects_limit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // Both existing commits are by test@example.com — limit to 1
        let result = list_commits(
            path,
            Some(1),
            Some(vec!["test@example.com".to_string()]),
        )
        .expect("Should return commits");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].message, "Add file");
    }

    #[test]
    fn test_list_commits_author_filter_empty_vec_returns_all() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // Empty filter should behave like no filter
        let result = list_commits(path, None, Some(vec![]))
            .expect("Should return commits");
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_list_authors_returns_unique_authors_with_metadata() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        Command::new("git")
            .args(["config", "user.email", "alice@example.com"])
            .current_dir(path)
            .output()
            .expect("Failed to set git email");
        Command::new("git")
            .args(["config", "user.name", "Alice"])
            .current_dir(path)
            .output()
            .expect("Failed to set git name");
        std::fs::write(path.join("alice.txt"), "alice's file").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Alice's commit"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(path)
            .output()
            .expect("Failed to reset git email");
        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(path)
            .output()
            .expect("Failed to reset git name");
        std::fs::write(path.join("follow-up.txt"), "follow up").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Follow-up commit"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        let authors = list_authors(path.to_str().unwrap()).expect("Should return authors");

        assert_eq!(authors.len(), 2);

        let alice = authors
            .iter()
            .find(|author| author.email == "alice@example.com")
            .expect("Alice should be present");
        assert_eq!(alice.name, "Alice");
        assert_eq!(alice.commit_count, 1);

        let test_user = authors
            .iter()
            .find(|author| author.email == "test@example.com")
            .expect("Test User should be present");
        assert_eq!(test_user.name, "Test User");
        assert_eq!(test_user.commit_count, 3);
        assert!(test_user.last_commit_timestamp >= alice.last_commit_timestamp);
    }

    #[test]
    fn test_list_commits_marks_unpushed_commits() {
        let (local_dir, _remote_dir) = create_test_repo_with_remote();
        let path = local_dir.path();
        let path_str = path.to_str().unwrap();

        // Add an unpushed commit
        std::fs::write(path.join("unpushed.txt"), "local only").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Unpushed commit"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        let commits = list_commits(path_str, None, None).expect("Should return commits");
        assert_eq!(commits.len(), 2);

        // First commit (most recent) is unpushed
        assert_eq!(commits[0].message, "Unpushed commit");
        assert_eq!(commits[0].is_pushed, false);

        // Second commit (initial) is pushed
        assert_eq!(commits[1].message, "Initial commit");
        assert_eq!(commits[1].is_pushed, true);
    }

    #[test]
    fn test_list_commits_all_pushed() {
        let (local_dir, _remote_dir) = create_test_repo_with_remote();
        let path_str = local_dir.path().to_str().unwrap();

        let commits = list_commits(path_str, None, None).expect("Should return commits");
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].is_pushed, true);
    }

    #[test]
    fn test_list_commits_marks_pushed_when_diverged() {
        let (local_dir, remote_dir) = create_test_repo_with_remote();
        let path = local_dir.path();
        let path_str = path.to_str().unwrap();

        // Add a local unpushed commit
        std::fs::write(path.join("local.txt"), "local change").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Local unpushed"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        // Simulate a remote commit by pushing from a separate clone
        let other_dir = TempDir::new().expect("Failed to create temp dir");
        let remote_url = remote_dir.path().to_str().unwrap();
        Command::new("git")
            .args(["clone", remote_url, other_dir.path().to_str().unwrap()])
            .output()
            .expect("Failed to clone");
        Command::new("git")
            .args(["config", "user.email", "other@example.com"])
            .current_dir(other_dir.path())
            .output()
            .expect("Failed to set email");
        Command::new("git")
            .args(["config", "user.name", "Other"])
            .current_dir(other_dir.path())
            .output()
            .expect("Failed to set name");
        std::fs::write(other_dir.path().join("remote.txt"), "remote change")
            .expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(other_dir.path())
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Remote commit"])
            .current_dir(other_dir.path())
            .output()
            .expect("Failed to commit");
        Command::new("git")
            .args(["push"])
            .current_dir(other_dir.path())
            .output()
            .expect("Failed to push from other clone");

        // Fetch in original repo so origin/main moves ahead
        Command::new("git")
            .args(["fetch"])
            .current_dir(path)
            .output()
            .expect("Failed to fetch");

        // Now local is diverged: 1 local commit, 1 remote-only commit
        // The merge base (Initial commit) should be marked pushed
        let commits = list_commits(path_str, None, None).expect("Should return commits");
        assert_eq!(commits.len(), 2); // Local unpushed + Initial commit

        assert_eq!(commits[0].message, "Local unpushed");
        assert_eq!(commits[0].is_pushed, false);

        assert_eq!(commits[1].message, "Initial commit");
        assert_eq!(commits[1].is_pushed, true);
    }

    #[test]
    fn test_list_commits_no_upstream_marks_all_unpushed() {
        let temp_dir = create_test_repo();
        let path_str = temp_dir.path().to_str().unwrap();

        // No remote configured — all commits should be marked as not pushed
        let commits = list_commits(path_str, None, None).expect("Should return commits");
        for commit in &commits {
            assert_eq!(commit.is_pushed, false, "Commit '{}' should not be marked pushed without upstream", commit.message);
        }
    }

    #[test]
    fn test_list_commits_is_pushed_works_with_author_filter() {
        let (local_dir, _remote_dir) = create_test_repo_with_remote();
        let path = local_dir.path();
        let path_str = path.to_str().unwrap();

        // Add unpushed commit by a different author
        Command::new("git")
            .args(["config", "user.email", "alice@example.com"])
            .current_dir(path)
            .output()
            .expect("Failed to set email");
        Command::new("git")
            .args(["config", "user.name", "Alice"])
            .current_dir(path)
            .output()
            .expect("Failed to set name");
        std::fs::write(path.join("alice.txt"), "alice's file").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Alice unpushed"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        // Add a pushed commit by alice (push everything, then add another unpushed one by test user)
        // Actually simpler: just verify that alice's filtered commit has is_pushed = false
        let alice_commits = list_commits(
            path_str,
            None,
            Some(vec!["alice@example.com".to_string()]),
        )
        .expect("Should return commits");
        assert_eq!(alice_commits.len(), 1);
        assert_eq!(alice_commits[0].message, "Alice unpushed");
        assert_eq!(alice_commits[0].is_pushed, false);
    }

    #[test]
    fn test_commit_has_valid_sha() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");

        // SHA should be 40 hex characters
        assert_eq!(commits[0].id.len(), 40);
        assert!(commits[0].id.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_commit_has_timestamp() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");

        // Timestamp should be a reasonable Unix timestamp (after 2020)
        assert!(commits[0].timestamp > 1577836800); // 2020-01-01
    }

    // Tests for get_commit_files

    #[test]
    fn test_get_commit_files_returns_added_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let latest_commit = &commits[0]; // "Add file" commit

        let files =
            get_commit_files(path, &latest_commit.id).expect("Should return changed files");

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "file.txt");
        assert_eq!(files[0].status, FileStatus::Added);
        assert!(files[0].additions > 0);
    }

    #[test]
    fn test_get_commit_files_initial_commit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let initial_commit = &commits[1]; // "Initial commit"

        let files =
            get_commit_files(path, &initial_commit.id).expect("Should return changed files");

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "README.md");
        assert_eq!(files[0].status, FileStatus::Added);
    }

    #[test]
    fn test_get_commit_files_modified_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify existing file
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Modify file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, Some(1), None).expect("Should return commits");
        let modify_commit = &commits[0];

        let files =
            get_commit_files(path_str, &modify_commit.id).expect("Should return changed files");

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "file.txt");
        assert_eq!(files[0].status, FileStatus::Modified);
    }

    #[test]
    fn test_get_commit_files_deleted_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Delete file
        std::fs::remove_file(path.join("file.txt")).expect("Failed to delete file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Delete file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, Some(1), None).expect("Should return commits");
        let delete_commit = &commits[0];

        let files =
            get_commit_files(path_str, &delete_commit.id).expect("Should return changed files");

        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "file.txt");
        assert_eq!(files[0].status, FileStatus::Deleted);
    }

    #[test]
    fn test_get_commit_files_invalid_commit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_commit_files(path, "0000000000000000000000000000000000000000");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to find commit"));
    }

    #[test]
    fn test_get_commit_files_invalid_commit_id_format() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_commit_files(path, "not-a-valid-sha");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid commit ID"));
    }

    #[test]
    fn test_get_commit_range_files_for_consecutive_commits() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let commit_ids = vec![commits[1].id.clone(), commits[0].id.clone()];

        let files = get_commit_range_files(path, &commit_ids).expect("Should return changed files");

        assert!(!files.is_empty());
        assert!(files.iter().any(|file| file.path == "README.md"));
        assert!(files.iter().any(|file| file.path == "file.txt"));
    }

    #[test]
    fn test_get_commit_range_files_rejects_non_consecutive_selection() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        std::fs::write(path.join("extra.txt"), "extra content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Add extra file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, None, None).expect("Should return commits");
        let non_consecutive_ids = vec![commits[0].id.clone(), commits[2].id.clone()];

        let result = get_commit_range_files(path_str, &non_consecutive_ids);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Unable to display diff for multiple non-consecutive commits"));
    }

    // Tests for get_file_diff

    #[test]
    fn test_get_file_diff_returns_diff() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let latest_commit = &commits[0]; // "Add file" commit

        let diff = get_file_diff(path, &latest_commit.id, "file.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // Check that hunks have lines
        let hunk = &diff.hunks[0];
        assert!(!hunk.lines.is_empty());

        // Added file should have all additions
        let additions: Vec<_> = hunk
            .lines
            .iter()
            .filter(|l| l.line_type == LineType::Addition)
            .collect();
        assert!(!additions.is_empty());
    }

    #[test]
    fn test_get_file_diff_modified_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify existing file
        std::fs::write(path.join("file.txt"), "line1\nline2\nmodified").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Modify file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, Some(1), None).expect("Should return commits");

        let diff =
            get_file_diff(path_str, &commits[0].id, "file.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "file.txt");
        assert!(!diff.is_binary);

        // Should have both deletions and additions
        let has_deletion = diff
            .hunks
            .iter()
            .any(|h| h.lines.iter().any(|l| l.line_type == LineType::Deletion));
        let has_addition = diff
            .hunks
            .iter()
            .any(|h| h.lines.iter().any(|l| l.line_type == LineType::Addition));

        assert!(has_deletion || has_addition);
    }

    #[test]
    fn test_get_file_diff_file_not_in_commit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let latest_commit = &commits[0];

        let result = get_file_diff(path, &latest_commit.id, "nonexistent.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found in commit"));
    }

    #[test]
    fn test_get_file_diff_line_numbers() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let latest_commit = &commits[0];

        let diff = get_file_diff(path, &latest_commit.id, "file.txt").expect("Should return diff");

        // For added file, lines should have new_line_no set
        for hunk in &diff.hunks {
            for line in &hunk.lines {
                if line.line_type == LineType::Addition {
                    assert!(line.new_line_no.is_some());
                }
            }
        }
    }

    // Tests for get_current_branch

    #[test]
    fn test_get_current_branch_returns_branch_name() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let branch = get_current_branch(path).expect("Should return branch name");

        // Default branch could be "master" or "main" depending on git config
        assert!(branch == "master" || branch == "main");
    }

    #[test]
    fn test_get_current_branch_new_branch() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create and checkout new branch
        Command::new("git")
            .args(["checkout", "-b", "feature-branch"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        let path_str = path.to_str().unwrap();
        let branch = get_current_branch(path_str).expect("Should return branch name");

        assert_eq!(branch, "feature-branch");
    }

    #[test]
    fn test_get_current_branch_detached_head() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, None, None).expect("Should return commits");

        // Checkout specific commit (detached HEAD)
        Command::new("git")
            .args(["checkout", &commits[1].id])
            .current_dir(path)
            .output()
            .expect("Failed to checkout commit");

        let branch = get_current_branch(path_str).expect("Should return something");

        // Should return the commit SHA when in detached HEAD
        assert_eq!(branch.len(), 40);
        assert!(branch.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_get_current_branch_invalid_path() {
        let result = get_current_branch("/nonexistent/path");
        assert!(result.is_err());
    }

    // Tests for validate_repo

    #[test]
    fn test_validate_repo_returns_info() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let info = validate_repo(path).expect("Should return repo info");

        assert!(info.path.len() > 0);
        assert!(info.name.len() > 0);
        assert!(info.branch == "master" || info.branch == "main");
    }

    #[test]
    fn test_validate_repo_invalid_path() {
        let result = validate_repo("/nonexistent/path");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a valid git repository"));
    }

    #[test]
    fn test_validate_repo_not_a_repo() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path().to_str().unwrap();

        let result = validate_repo(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_repo_path_is_normalized() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let info = validate_repo(path).expect("Should return repo info");

        // Path should be absolute
        assert!(info.path.starts_with('/'));
    }

    // Tests for get_file_contents

    #[test]
    fn test_get_file_contents_added_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let add_commit = &commits[0]; // "Add file" commit

        let contents =
            get_file_contents(path, &add_commit.id, "file.txt").expect("Should return contents");

        assert!(!contents.is_binary);
        assert!(contents.old_content.is_none()); // File didn't exist before
        assert_eq!(contents.new_content, Some("content".to_string()));
    }

    #[test]
    fn test_get_file_contents_modified_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify existing file
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Modify file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, Some(1), None).expect("Should return commits");

        let contents = get_file_contents(path_str, &commits[0].id, "file.txt")
            .expect("Should return contents");

        assert!(!contents.is_binary);
        assert_eq!(contents.old_content, Some("content".to_string()));
        assert_eq!(contents.new_content, Some("modified content".to_string()));
    }

    #[test]
    fn test_get_file_contents_deleted_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Delete file
        std::fs::remove_file(path.join("file.txt")).expect("Failed to delete file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Delete file"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, Some(1), None).expect("Should return commits");

        let contents = get_file_contents(path_str, &commits[0].id, "file.txt")
            .expect("Should return contents");

        assert!(!contents.is_binary);
        assert_eq!(contents.old_content, Some("content".to_string()));
        assert!(contents.new_content.is_none()); // File was deleted
    }

    #[test]
    fn test_get_file_contents_file_not_in_commit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");

        let result = get_file_contents(path, &commits[0].id, "nonexistent.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found in commit"));
    }

    // Tests for get_working_changes

    #[test]
    fn test_get_working_changes_no_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let changes = get_working_changes(path).expect("Should return changes");

        assert!(changes.is_empty());
    }

    #[test]
    fn test_get_working_changes_modified_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file without committing
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "file.txt");
        assert_eq!(changes[0].status, FileStatus::Modified);
    }

    #[test]
    fn test_get_working_changes_untracked_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create new file without adding
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "newfile.txt");
        assert_eq!(changes[0].status, FileStatus::Untracked);
    }

    #[test]
    fn test_get_working_changes_staged_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create and stage new file
        std::fs::write(path.join("staged.txt"), "staged content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "staged.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to add file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "staged.txt");
        assert_eq!(changes[0].status, FileStatus::Added);
    }

    #[test]
    fn test_get_working_changes_deleted_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Delete tracked file
        std::fs::remove_file(path.join("file.txt")).expect("Failed to delete file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "file.txt");
        assert_eq!(changes[0].status, FileStatus::Deleted);
    }

    #[test]
    fn test_get_working_changes_multiple_files() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create multiple changes
        std::fs::write(path.join("file.txt"), "modified").expect("Failed to write");
        std::fs::write(path.join("new.txt"), "new").expect("Failed to write");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 2);
    }

    // Tests for get_working_file_diff

    #[test]
    fn test_get_working_file_diff_modified() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file
        std::fs::write(path.join("file.txt"), "line1\nline2\nnew line").expect("Failed to write");

        let path_str = path.to_str().unwrap();
        let diff = get_working_file_diff(path_str, "file.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // Should have additions
        let has_addition = diff
            .hunks
            .iter()
            .any(|h| h.lines.iter().any(|l| l.line_type == LineType::Addition));
        assert!(has_addition);
    }

    #[test]
    fn test_get_working_file_diff_untracked() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create untracked file
        std::fs::write(path.join("untracked.txt"), "new file content").expect("Failed to write");

        let path_str = path.to_str().unwrap();
        let diff = get_working_file_diff(path_str, "untracked.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "untracked.txt");
        assert!(!diff.is_binary);

        // All lines should be additions
        for hunk in &diff.hunks {
            for line in &hunk.lines {
                assert_eq!(line.line_type, LineType::Addition);
            }
        }
    }

    #[test]
    fn test_get_working_file_diff_no_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_working_file_diff(path, "file.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no changes"));
    }

    #[test]
    fn test_get_working_file_diff_nonexistent() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_working_file_diff(path, "nonexistent.txt");
        assert!(result.is_err());
    }

    // Tests for get_working_file_contents

    #[test]
    fn test_get_working_file_contents_modified() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write");

        let path_str = path.to_str().unwrap();
        let contents =
            get_working_file_contents(path_str, "file.txt").expect("Should return contents");

        assert!(!contents.is_binary);
        assert_eq!(contents.old_content, Some("content".to_string()));
        assert_eq!(contents.new_content, Some("modified content".to_string()));
    }

    #[test]
    fn test_get_working_file_contents_new_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create new file
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write");

        let path_str = path.to_str().unwrap();
        let contents =
            get_working_file_contents(path_str, "newfile.txt").expect("Should return contents");

        assert!(!contents.is_binary);
        assert!(contents.old_content.is_none()); // File didn't exist in HEAD
        assert_eq!(contents.new_content, Some("new content".to_string()));
    }

    #[test]
    fn test_get_working_file_contents_deleted_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Delete file
        std::fs::remove_file(path.join("file.txt")).expect("Failed to delete");

        let path_str = path.to_str().unwrap();
        let contents =
            get_working_file_contents(path_str, "file.txt").expect("Should return contents");

        assert!(!contents.is_binary);
        assert_eq!(contents.old_content, Some("content".to_string()));
        assert!(contents.new_content.is_none()); // File was deleted
    }

    #[test]
    fn test_get_working_file_contents_nonexistent() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_working_file_contents(path, "nonexistent.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    // Tests for list_branches

    #[test]
    fn test_list_branches_returns_current_branch() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let branches = list_branches(path).expect("Should return branches");

        assert!(!branches.is_empty());
        // Should have at least one branch marked as current
        let current = branches.iter().find(|b| b.is_current);
        assert!(current.is_some());
        // Current branch should be master or main
        let current_name = &current.unwrap().name;
        assert!(current_name == "master" || current_name == "main");
    }

    #[test]
    fn test_list_branches_multiple_branches() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create additional branches
        Command::new("git")
            .args(["branch", "feature-a"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");
        Command::new("git")
            .args(["branch", "feature-b"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        let path_str = path.to_str().unwrap();
        let branches = list_branches(path_str).expect("Should return branches");

        // Should have 3 local branches
        let local_branches: Vec<_> = branches.iter().filter(|b| !b.is_remote).collect();
        assert_eq!(local_branches.len(), 3);
    }

    #[test]
    fn test_list_branches_current_first() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create another branch
        Command::new("git")
            .args(["branch", "zzz-last"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        let path_str = path.to_str().unwrap();
        let branches = list_branches(path_str).expect("Should return branches");

        // Current branch should be first
        assert!(branches[0].is_current);
    }

    #[test]
    fn test_list_branches_has_commit_id() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let branches = list_branches(path).expect("Should return branches");

        // All branches should have a commit ID
        for branch in &branches {
            assert!(!branch.commit_id.is_empty());
            assert_eq!(branch.commit_id.len(), 40);
        }
    }

    #[test]
    fn test_list_branches_invalid_path() {
        let result = list_branches("/nonexistent/path");
        assert!(result.is_err());
    }

    // Tests for checkout_branch

    #[test]
    fn test_checkout_branch_switches_branch() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create a new branch
        Command::new("git")
            .args(["branch", "feature"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        let path_str = path.to_str().unwrap();

        // Checkout the new branch
        checkout_branch(path_str, "feature").expect("Should checkout branch");

        // Verify we're on the new branch
        let current = get_current_branch(path_str).expect("Should get current branch");
        assert_eq!(current, "feature");
    }

    #[test]
    fn test_checkout_branch_nonexistent() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = checkout_branch(path, "nonexistent-branch");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_checkout_branch_with_uncommitted_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create a new branch
        Command::new("git")
            .args(["branch", "feature"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        // Make uncommitted changes
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let result = checkout_branch(path_str, "feature");

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("uncommitted changes"));
    }

    #[test]
    fn test_checkout_branch_with_untracked_files_allowed() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create a new branch
        Command::new("git")
            .args(["branch", "feature"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        // Create untracked file (should not block checkout)
        std::fs::write(path.join("untracked.txt"), "new file").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let result = checkout_branch(path_str, "feature");

        // Untracked files should not block checkout
        assert!(result.is_ok());
    }

    #[test]
    fn test_checkout_branch_updates_working_directory() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();
        let path_str = path.to_str().unwrap();

        // Get the current branch name (master or main)
        let main_branch = get_current_branch(path_str).expect("Should get branch");

        // Create a new branch and add a file
        Command::new("git")
            .args(["checkout", "-b", "feature"])
            .current_dir(path)
            .output()
            .expect("Failed to create branch");

        std::fs::write(path.join("feature-file.txt"), "feature content")
            .expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Add feature file"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        // Go back to main/master using git command
        Command::new("git")
            .args(["checkout", &main_branch])
            .current_dir(path)
            .output()
            .expect("Failed to checkout main");

        // File should not exist on main branch
        assert!(!path.join("feature-file.txt").exists());

        // Checkout feature branch using our function
        checkout_branch(path_str, "feature").expect("Should checkout branch");

        // File should now exist
        assert!(path.join("feature-file.txt").exists());
    }

    #[test]
    fn test_checkout_branch_invalid_path() {
        let result = checkout_branch("/nonexistent/path", "main");
        assert!(result.is_err());
    }

    // Tests for get_working_changes_ex with staged/unstaged split

    #[test]
    fn test_get_working_changes_ex_returns_empty_when_no_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let changes = get_working_changes_ex(path).expect("Should return changes");

        assert!(changes.is_empty());
    }

    #[test]
    fn test_get_working_changes_ex_unstaged_file_appears_in_unstaged_only() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file without staging
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes_ex(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "file.txt");
        assert!(changes[0].unstaged_status.is_some());
        assert!(changes[0].staged_status.is_none());
        assert_eq!(changes[0].unstaged_status, Some(FileStatus::Modified));
    }

    #[test]
    fn test_get_working_changes_ex_staged_file_appears_in_staged_only() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage file
        std::fs::write(path.join("file.txt"), "staged content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes_ex(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "file.txt");
        assert!(changes[0].staged_status.is_some());
        assert!(changes[0].unstaged_status.is_none());
        assert_eq!(changes[0].staged_status, Some(FileStatus::Modified));
    }

    #[test]
    fn test_get_working_changes_ex_file_with_both_staged_and_unstaged_appears_twice() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage file
        std::fs::write(path.join("file.txt"), "staged content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        // Modify again (now has both staged and unstaged changes)
        std::fs::write(path.join("file.txt"), "staged and unstaged content")
            .expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes_ex(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 2);

        // Find staged entry
        let staged = changes
            .iter()
            .find(|c| c.staged_status.is_some())
            .expect("Should have staged entry");
        assert_eq!(staged.path, "file.txt");
        assert_eq!(staged.staged_status, Some(FileStatus::Modified));
        assert!(staged.unstaged_status.is_none());

        // Find unstaged entry
        let unstaged = changes
            .iter()
            .find(|c| c.unstaged_status.is_some())
            .expect("Should have unstaged entry");
        assert_eq!(unstaged.path, "file.txt");
        assert_eq!(unstaged.unstaged_status, Some(FileStatus::Modified));
        assert!(unstaged.staged_status.is_none());
    }

    #[test]
    fn test_get_working_changes_ex_tracks_line_counts_separately() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create file with staged changes
        std::fs::write(path.join("file.txt"), "line1\nline2").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        // Modify with unstaged changes
        std::fs::write(path.join("file.txt"), "line1\nline2\nline3").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes_ex(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 2);

        let staged = changes.iter().find(|c| c.staged_status.is_some()).unwrap();
        let unstaged = changes.iter().find(|c| c.unstaged_status.is_some()).unwrap();

        // Staged should have counts for staging "line1\nline2"
        assert!(staged.staged_additions > 0);
        assert_eq!(staged.unstaged_additions, 0);

        // Unstaged should have counts for adding "line3"
        assert!(unstaged.unstaged_additions > 0);
        assert_eq!(unstaged.staged_additions, 0);
    }

    #[test]
    fn test_get_working_changes_ex_new_file_staged_only() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create and stage new file
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "newfile.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes_ex(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "newfile.txt");
        assert_eq!(changes[0].staged_status, Some(FileStatus::Added));
        assert!(changes[0].unstaged_status.is_none());
    }

    #[test]
    fn test_get_working_changes_ex_untracked_file_appears_in_unstaged() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create new file without adding
        std::fs::write(path.join("untracked.txt"), "untracked content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let changes = get_working_changes_ex(path_str).expect("Should return changes");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "untracked.txt");
        assert_eq!(changes[0].unstaged_status, Some(FileStatus::Untracked));
        assert!(changes[0].staged_status.is_none());
    }

    // Tests for get_staged_file_diff

    #[test]
    fn test_get_staged_file_diff_shows_staged_changes_only() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage the file
        std::fs::write(path.join("file.txt"), "staged content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        // Modify again (unstaged changes)
        std::fs::write(path.join("file.txt"), "staged and unstaged content")
            .expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let diff = get_staged_file_diff(path_str, "file.txt").expect("Should return diff");

        // Staged diff should only show "staged content", not the unstaged changes
        assert_eq!(diff.new_path, "file.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // The diff should contain "staged content" (what was staged)
        let content: String = diff
            .hunks
            .iter()
            .flat_map(|h| &h.lines)
            .map(|l| &l.content[..])
            .collect();
        assert!(content.contains("staged content"));
        assert!(!content.contains("unstaged"));
    }

    #[test]
    fn test_get_staged_file_diff_returns_error_for_unstaged_only_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file without staging
        std::fs::write(path.join("file.txt"), "unstaged changes").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let result = get_staged_file_diff(path_str, "file.txt");

        assert!(result.is_err());
    }

    #[test]
    fn test_get_staged_file_diff_new_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create and stage new file
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "newfile.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        let path_str = path.to_str().unwrap();
        let diff = get_staged_file_diff(path_str, "newfile.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "newfile.txt");
        assert!(!diff.is_binary);
        assert!(!diff.hunks.is_empty());

        // Should have at least one addition line (new file)
        let has_addition = diff
            .hunks
            .iter()
            .flat_map(|h| &h.lines)
            .any(|l| l.line_type == LineType::Addition);
        assert!(has_addition, "New file should have addition lines");
    }

    // Tests for get_unstaged_file_diff

    #[test]
    fn test_get_unstaged_file_diff_shows_unstaged_changes_only() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage
        std::fs::write(path.join("file.txt"), "staged content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        // Modify again (unstaged)
        std::fs::write(path.join("file.txt"), "staged and unstaged content")
            .expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let diff = get_unstaged_file_diff(path_str, "file.txt").expect("Should return diff");

        // Unstaged diff should show the difference between staged and working
        assert_eq!(diff.new_path, "file.txt");
        assert!(!diff.is_binary);

        // The diff should show the transition from "staged content" to final content
        let has_context_or_change = diff
            .hunks
            .iter()
            .flat_map(|h| &h.lines)
            .any(|l| l.line_type == LineType::Addition || l.line_type == LineType::Context);
        assert!(has_context_or_change);
    }

    #[test]
    fn test_get_unstaged_file_diff_unstaged_only_shows_vs_head() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify without staging
        std::fs::write(path.join("file.txt"), "only unstaged").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let diff = get_unstaged_file_diff(path_str, "file.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "file.txt");
        assert!(!diff.is_binary);
    }

    #[test]
    fn test_get_unstaged_file_diff_returns_error_when_no_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // No changes to file.txt
        let result = get_unstaged_file_diff(path, "file.txt");

        assert!(result.is_err());
    }

    #[test]
    fn test_get_unstaged_file_diff_untracked_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create untracked file
        std::fs::write(path.join("untracked.txt"), "new untracked").expect("Failed to write file");

        let path_str = path.to_str().unwrap();
        let diff = get_unstaged_file_diff(path_str, "untracked.txt").expect("Should return diff");

        assert_eq!(diff.new_path, "untracked.txt");
        assert!(!diff.is_binary);
    }

    // Tests for unstage_file

    #[test]
    fn test_unstage_file_removes_staged_modification() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage
        std::fs::write(path.join("file.txt"), "staged content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        let path_str = path.to_str().unwrap();

        // Verify file is staged
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before.iter().any(|c| c.staged_status.is_some()));

        // Unstage the file
        unstage_file(path_str, "file.txt").expect("Should unstage file");

        // Verify file is now unstaged only
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        let staged_count = changes_after
            .iter()
            .filter(|c| c.staged_status.is_some())
            .count();
        assert_eq!(staged_count, 0);

        // Should still have unstaged changes
        let unstaged_count = changes_after
            .iter()
            .filter(|c| c.unstaged_status.is_some())
            .count();
        assert_eq!(unstaged_count, 1);
    }

    #[test]
    fn test_unstage_file_removes_new_file_from_index() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create and stage new file
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "newfile.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        let path_str = path.to_str().unwrap();

        // Verify file is staged as Added
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before
            .iter()
            .any(|c| c.path == "newfile.txt" && c.staged_status == Some(FileStatus::Added)));

        // Unstage the file
        unstage_file(path_str, "newfile.txt").expect("Should unstage file");

        // File should now be untracked
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after
            .iter()
            .any(|c| c.path == "newfile.txt" && c.unstaged_status == Some(FileStatus::Untracked)));
    }

    // Tests for discard_file

    #[test]
    fn test_discard_file_restores_modified_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file (unstaged)
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();

        // Verify file has unstaged changes
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before
            .iter()
            .any(|c| c.path == "file.txt" && c.unstaged_status.is_some()));

        // Discard changes
        discard_file(path_str, "file.txt").expect("Should discard changes");

        // Verify file content is restored
        let content = std::fs::read_to_string(path.join("file.txt")).expect("Should read file");
        assert_eq!(content, "content");

        // No more changes
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after.iter().all(|c| c.path != "file.txt"));
    }

    #[test]
    fn test_discard_file_deletes_untracked_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create untracked file
        std::fs::write(path.join("untracked.txt"), "untracked content")
            .expect("Failed to write file");

        let path_str = path.to_str().unwrap();

        // Verify file exists and is untracked
        assert!(path.join("untracked.txt").exists());
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before.iter().any(|c| c.path == "untracked.txt"
            && c.unstaged_status == Some(FileStatus::Untracked)));

        // Discard (delete) the file
        discard_file(path_str, "untracked.txt").expect("Should discard file");

        // Verify file is deleted
        assert!(!path.join("untracked.txt").exists());

        // No more changes for this file
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after.iter().all(|c| c.path != "untracked.txt"));
    }

    #[test]
    fn test_discard_file_restores_to_staged_version() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage
        std::fs::write(path.join("file.txt"), "staged version").expect("Failed to write file");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage file");

        // Modify again (unstaged changes on top of staged)
        std::fs::write(path.join("file.txt"), "unstaged version").expect("Failed to write file");

        let path_str = path.to_str().unwrap();

        // Discard unstaged changes
        discard_file(path_str, "file.txt").expect("Should discard changes");

        // File should now match staged version
        let content = std::fs::read_to_string(path.join("file.txt")).expect("Should read file");
        assert_eq!(content, "staged version");

        // Should still have staged changes
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after
            .iter()
            .any(|c| c.path == "file.txt" && c.staged_status.is_some()));
        // Should not have unstaged changes
        assert!(changes_after
            .iter()
            .all(|c| c.path != "file.txt" || c.unstaged_status.is_none()));
    }

    #[test]
    fn test_discard_file_error_when_no_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // File exists but has no changes
        let result = discard_file(path, "file.txt");

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("no changes to discard"));
    }

    fn create_test_repo_with_remote() -> (TempDir, TempDir) {
        // Create a bare "remote" repo
        let remote_dir = TempDir::new().expect("Failed to create remote temp directory");
        Command::new("git")
            .args(["init", "--bare"])
            .current_dir(remote_dir.path())
            .output()
            .expect("Failed to init bare repo");

        // Create a local repo and add the remote
        let local_dir = TempDir::new().expect("Failed to create local temp directory");
        let local_path = local_dir.path();

        Command::new("git")
            .args(["init"])
            .current_dir(local_path)
            .output()
            .expect("Failed to init git repo");
        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(local_path)
            .output()
            .expect("Failed to set git email");
        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(local_path)
            .output()
            .expect("Failed to set git name");

        let remote_url = remote_dir.path().to_str().unwrap();
        Command::new("git")
            .args(["remote", "add", "origin", remote_url])
            .current_dir(local_path)
            .output()
            .expect("Failed to add remote");

        // Create initial commit and push
        std::fs::write(local_path.join("README.md"), "# Test").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(local_path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(local_path)
            .output()
            .expect("Failed to create commit");

        // Get the branch name (could be main or master)
        let branch_output = Command::new("git")
            .args(["branch", "--show-current"])
            .current_dir(local_path)
            .output()
            .expect("Failed to get branch name");
        let branch_name = String::from_utf8(branch_output.stdout)
            .unwrap()
            .trim()
            .to_string();

        Command::new("git")
            .args(["push", "-u", "origin", &branch_name])
            .current_dir(local_path)
            .output()
            .expect("Failed to push");

        (local_dir, remote_dir)
    }

    #[test]
    fn test_get_ahead_behind_returns_zero_when_in_sync() {
        let (local_dir, _remote_dir) = create_test_repo_with_remote();
        let path = local_dir.path().to_str().unwrap();

        let result = get_ahead_behind(path).expect("Should return ahead/behind");
        assert_eq!(result.ahead, 0);
        assert_eq!(result.behind, 0);
    }

    #[test]
    fn test_get_ahead_behind_counts_unpushed_commits() {
        let (local_dir, _remote_dir) = create_test_repo_with_remote();
        let path = local_dir.path();

        // Create two unpushed commits
        std::fs::write(path.join("file1.txt"), "content1").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Local commit 1"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        std::fs::write(path.join("file2.txt"), "content2").expect("Failed to write");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add");
        Command::new("git")
            .args(["commit", "-m", "Local commit 2"])
            .current_dir(path)
            .output()
            .expect("Failed to commit");

        let path_str = path.to_str().unwrap();
        let result = get_ahead_behind(path_str).expect("Should return ahead/behind");
        assert_eq!(result.ahead, 2);
        assert_eq!(result.behind, 0);
    }

    #[test]
    fn test_get_ahead_behind_error_when_no_upstream() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_ahead_behind(path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No upstream tracking branch"));
    }

    #[test]
    fn test_get_remote_url_returns_origin_url() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // Add a remote
        Command::new("git")
            .args(["remote", "add", "origin", "https://github.com/owner/repo.git"])
            .current_dir(path)
            .output()
            .expect("Failed to add remote");

        let result = get_remote_url(path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://github.com/owner/repo.git");
    }

    #[test]
    fn test_get_remote_url_error_when_no_origin() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_remote_url(path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No 'origin' remote configured"));
    }

    // Tests for reword_commit

    // Tests for get_commit_message

    #[test]
    fn test_get_commit_message_returns_full_message() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create a commit with a multi-line message
        std::fs::write(path.join("multi.txt"), "content").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Summary line\n\nDetailed body paragraph.\nSecond line of body."])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, None, None).expect("Should return commits");

        let full_message = get_commit_message(path_str, &commits[0].id)
            .expect("Should return full message");

        assert!(full_message.starts_with("Summary line"));
        assert!(full_message.contains("Detailed body paragraph."));
        assert!(full_message.contains("Second line of body."));
    }

    #[test]
    fn test_get_commit_message_single_line() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");

        let message = get_commit_message(path, &commits[0].id)
            .expect("Should return message");

        assert_eq!(message.trim(), "Add file");
    }

    #[test]
    fn test_get_commit_message_invalid_commit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = get_commit_message(path, "0000000000000000000000000000000000000000");
        assert!(result.is_err());
    }

    // Tests for reword_commit

    #[test]
    fn test_reword_commit_head() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let head_commit = &commits[0];
        assert_eq!(head_commit.message, "Add file");

        reword_commit(path, &head_commit.id, "Reworded message")
            .expect("Should reword HEAD commit");

        let commits_after = list_commits(path, None, None).expect("Should return commits");
        assert_eq!(commits_after[0].message, "Reworded message");
        // Other commits should be unchanged
        assert_eq!(commits_after[1].message, "Initial commit");
        assert_eq!(commits_after[1].id, commits[1].id);
    }

    #[test]
    fn test_reword_commit_non_head() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Add a third commit so we can reword the middle one
        std::fs::write(path.join("another.txt"), "another").expect("Failed to write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .output()
            .expect("Failed to add files");
        Command::new("git")
            .args(["commit", "-m", "Third commit"])
            .current_dir(path)
            .output()
            .expect("Failed to create commit");

        let path_str = path.to_str().unwrap();
        let commits = list_commits(path_str, None, None).expect("Should return commits");
        assert_eq!(commits.len(), 3);
        // commits[0] = "Third commit", commits[1] = "Add file", commits[2] = "Initial commit"

        let middle_commit_id = commits[1].id.clone();
        reword_commit(path_str, &middle_commit_id, "Reworded middle")
            .expect("Should reword non-HEAD commit");

        let commits_after = list_commits(path_str, None, None).expect("Should return commits");
        assert_eq!(commits_after.len(), 3);
        assert_eq!(commits_after[0].message, "Third commit");
        assert_eq!(commits_after[1].message, "Reworded middle");
        assert_eq!(commits_after[2].message, "Initial commit");
        // The initial commit should be unchanged
        assert_eq!(commits_after[2].id, commits[2].id);
        // The reworded commit and its descendant should have new IDs
        assert_ne!(commits_after[1].id, commits[1].id);
        assert_ne!(commits_after[0].id, commits[0].id);
    }

    #[test]
    fn test_reword_commit_preserves_tree() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let files_before = get_commit_files(path, &commits[0].id).expect("Should get files");

        reword_commit(path, &commits[0].id, "New message")
            .expect("Should reword commit");

        let commits_after = list_commits(path, None, None).expect("Should return commits");
        let files_after = get_commit_files(path, &commits_after[0].id).expect("Should get files");

        assert_eq!(files_before.len(), files_after.len());
        assert_eq!(files_before[0].path, files_after[0].path);
    }

    #[test]
    fn test_reword_commit_not_found() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = reword_commit(path, "0000000000000000000000000000000000000000", "New msg");
        assert!(result.is_err());
    }

    #[test]
    fn test_reword_commit_root_commit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None, None).expect("Should return commits");
        let root_commit = &commits[commits.len() - 1]; // "Initial commit"
        assert_eq!(root_commit.message, "Initial commit");

        reword_commit(path, &root_commit.id, "Reworded root")
            .expect("Should reword root commit");

        let commits_after = list_commits(path, None, None).expect("Should return commits");
        assert_eq!(commits_after[commits_after.len() - 1].message, "Reworded root");
        // All commits should have new IDs since root was rewritten
        assert_ne!(commits_after[0].id, commits[0].id);
    }

    // Tests for stage_file

    #[test]
    fn test_stage_file_stages_modified_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify file (unstaged)
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();

        // Verify file has unstaged changes only
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before
            .iter()
            .any(|c| c.path == "file.txt" && c.unstaged_status.is_some() && c.staged_status.is_none()));

        // Stage the file
        stage_file(path_str, "file.txt").expect("Should stage file");

        // Verify file is now staged
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after
            .iter()
            .any(|c| c.path == "file.txt" && c.staged_status == Some(FileStatus::Modified)));
        // Should have no unstaged changes for this file
        assert!(changes_after
            .iter()
            .all(|c| c.path != "file.txt" || c.unstaged_status.is_none()));
    }

    #[test]
    fn test_stage_file_stages_new_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create untracked file
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write file");

        let path_str = path.to_str().unwrap();

        // Verify file is untracked
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before
            .iter()
            .any(|c| c.path == "newfile.txt" && c.unstaged_status == Some(FileStatus::Untracked)));

        // Stage the file
        stage_file(path_str, "newfile.txt").expect("Should stage file");

        // Verify file is now staged as Added
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after
            .iter()
            .any(|c| c.path == "newfile.txt" && c.staged_status == Some(FileStatus::Added)));
    }

    #[test]
    fn test_stage_file_stages_deleted_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Delete a tracked file
        std::fs::remove_file(path.join("file.txt")).expect("Failed to delete file");

        let path_str = path.to_str().unwrap();

        // Verify file has unstaged deletion
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_before
            .iter()
            .any(|c| c.path == "file.txt" && c.unstaged_status == Some(FileStatus::Deleted)));

        // Stage the deletion
        stage_file(path_str, "file.txt").expect("Should stage file");

        // Verify file is now staged as Deleted
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        assert!(changes_after
            .iter()
            .any(|c| c.path == "file.txt" && c.staged_status == Some(FileStatus::Deleted)));
        // Should have no unstaged changes for this file
        assert!(changes_after
            .iter()
            .all(|c| c.path != "file.txt" || c.unstaged_status.is_none()));
    }

    // Tests for stage_all

    #[test]
    fn test_stage_all_stages_all_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create multiple kinds of changes
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write");
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write");
        std::fs::remove_file(path.join("README.md")).expect("Failed to delete");

        let path_str = path.to_str().unwrap();

        // Verify all changes are unstaged
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        let unstaged_count = changes_before
            .iter()
            .filter(|c| c.unstaged_status.is_some())
            .count();
        assert_eq!(unstaged_count, 3);

        // Stage all
        stage_all(path_str).expect("Should stage all");

        // Verify all changes are now staged
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        let staged_count = changes_after
            .iter()
            .filter(|c| c.staged_status.is_some())
            .count();
        assert_eq!(staged_count, 3);

        // No unstaged changes should remain
        let unstaged_count = changes_after
            .iter()
            .filter(|c| c.unstaged_status.is_some())
            .count();
        assert_eq!(unstaged_count, 0);
    }

    #[test]
    fn test_stage_all_with_no_changes_succeeds() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // No changes — should succeed without error
        let result = stage_all(path);
        assert!(result.is_ok());
    }

    // Tests for unstage_all

    #[test]
    fn test_unstage_all_unstages_all_staged_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Create and stage multiple changes
        std::fs::write(path.join("file.txt"), "modified content").expect("Failed to write");
        std::fs::write(path.join("newfile.txt"), "new content").expect("Failed to write");
        Command::new("git")
            .args(["add", "-A"])
            .current_dir(path)
            .output()
            .expect("Failed to stage all");

        let path_str = path.to_str().unwrap();

        // Verify changes are staged
        let changes_before = get_working_changes_ex(path_str).expect("Should get changes");
        let staged_count = changes_before
            .iter()
            .filter(|c| c.staged_status.is_some())
            .count();
        assert!(staged_count >= 2);

        // Unstage all
        unstage_all(path_str).expect("Should unstage all");

        // Verify no changes are staged
        let changes_after = get_working_changes_ex(path_str).expect("Should get changes");
        let staged_count = changes_after
            .iter()
            .filter(|c| c.staged_status.is_some())
            .count();
        assert_eq!(staged_count, 0);

        // Changes should still exist as unstaged
        let unstaged_count = changes_after
            .iter()
            .filter(|c| c.unstaged_status.is_some())
            .count();
        assert!(unstaged_count >= 2);
    }

    #[test]
    fn test_unstage_all_with_no_staged_changes_succeeds() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        // No staged changes — should succeed without error
        let result = unstage_all(path);
        assert!(result.is_ok());
    }

    // Tests for create_commit

    #[test]
    fn test_create_commit_with_staged_changes() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        // Modify and stage a file
        std::fs::write(path.join("file.txt"), "committed content").expect("Failed to write");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage");

        let path_str = path.to_str().unwrap();

        create_commit(path_str, "New commit message").expect("Should create commit");

        // New HEAD should have the correct message
        let commits = list_commits(path_str, Some(1), None).expect("Should list commits");
        assert_eq!(commits[0].message, "New commit message");

        // No staged changes should remain
        let changes = get_working_changes_ex(path_str).expect("Should get changes");
        let staged_count = changes.iter().filter(|c| c.staged_status.is_some()).count();
        assert_eq!(staged_count, 0);
    }

    #[test]
    fn test_create_commit_with_no_staged_changes_fails() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let result = create_commit(path, "Empty commit");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No staged changes"));
    }

    #[test]
    fn test_create_commit_preserves_multiline_message() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path();

        std::fs::write(path.join("file.txt"), "updated").expect("Failed to write");
        Command::new("git")
            .args(["add", "file.txt"])
            .current_dir(path)
            .output()
            .expect("Failed to stage");

        let path_str = path.to_str().unwrap();
        let message = "Summary line\n\nDetailed body paragraph\nwith multiple lines.";

        create_commit(path_str, message).expect("Should create commit");

        // Verify the full message is preserved
        let commits = list_commits(path_str, Some(1), None).expect("Should list commits");
        let full_message =
            get_commit_message(path_str, &commits[0].id).expect("Should get message");
        assert!(full_message.starts_with("Summary line\n\nDetailed body paragraph"));
    }
}
