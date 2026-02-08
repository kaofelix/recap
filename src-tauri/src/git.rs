use git2::Repository;
use serde::Serialize;

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
}
