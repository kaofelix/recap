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
}

/// Lists commits from a git repository
///
/// # Arguments
/// * `repo_path` - Path to the git repository
/// * `limit` - Maximum number of commits to return (defaults to 100)
///
/// # Returns
/// A vector of Commit structs or an error message
pub fn list_commits(repo_path: &str, limit: Option<usize>) -> Result<Vec<Commit>, String> {
    let repo = Repository::open(repo_path).map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut revwalk = repo.revwalk().map_err(|e| format!("Failed to create revwalk: {}", e))?;

    // Start from HEAD
    revwalk.push_head().map_err(|e| format!("Failed to push HEAD: {}", e))?;

    let limit = limit.unwrap_or(100);
    let mut commits = Vec::new();

    for (count, oid_result) in revwalk.enumerate() {
        if count >= limit {
            break;
        }

        let oid = oid_result.map_err(|e| format!("Failed to get commit oid: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        let author = commit.author();
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
            email: author.email().unwrap_or("").to_string(),
            timestamp: author.when().seconds(),
        });
    }

    Ok(commits)
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

        let commits = list_commits(path, None).expect("Should return commits");

        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].message, "Add file");
        assert_eq!(commits[1].message, "Initial commit");
    }

    #[test]
    fn test_list_commits_respects_limit() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, Some(1)).expect("Should return commits");

        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, "Add file");
    }

    #[test]
    fn test_list_commits_includes_author_info() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None).expect("Should return commits");

        assert_eq!(commits[0].author, "Test User");
        assert_eq!(commits[0].email, "test@example.com");
    }

    #[test]
    fn test_list_commits_invalid_path() {
        let result = list_commits("/nonexistent/path", None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open repository"));
    }

    #[test]
    fn test_list_commits_not_a_repo() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path().to_str().unwrap();

        let result = list_commits(path, None);
        assert!(result.is_err());
    }

    #[test]
    fn test_commit_has_valid_sha() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None).expect("Should return commits");

        // SHA should be 40 hex characters
        assert_eq!(commits[0].id.len(), 40);
        assert!(commits[0].id.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_commit_has_timestamp() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None).expect("Should return commits");

        // Timestamp should be a reasonable Unix timestamp (after 2020)
        assert!(commits[0].timestamp > 1577836800); // 2020-01-01
    }

    // Tests for get_commit_files

    #[test]
    fn test_get_commit_files_returns_added_file() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None).expect("Should return commits");
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

        let commits = list_commits(path, None).expect("Should return commits");
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
        let commits = list_commits(path_str, Some(1)).expect("Should return commits");
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
        let commits = list_commits(path_str, Some(1)).expect("Should return commits");
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

    // Tests for get_file_diff

    #[test]
    fn test_get_file_diff_returns_diff() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None).expect("Should return commits");
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
        let commits = list_commits(path_str, Some(1)).expect("Should return commits");

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

        let commits = list_commits(path, None).expect("Should return commits");
        let latest_commit = &commits[0];

        let result = get_file_diff(path, &latest_commit.id, "nonexistent.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found in commit"));
    }

    #[test]
    fn test_get_file_diff_line_numbers() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();

        let commits = list_commits(path, None).expect("Should return commits");
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
        let commits = list_commits(path_str, None).expect("Should return commits");

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

        let commits = list_commits(path, None).expect("Should return commits");
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
        let commits = list_commits(path_str, Some(1)).expect("Should return commits");

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
        let commits = list_commits(path_str, Some(1)).expect("Should return commits");

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

        let commits = list_commits(path, None).expect("Should return commits");

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
}
