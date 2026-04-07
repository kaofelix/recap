use std::collections::HashMap;
use std::sync::Mutex;

use git2::Repository;

/// Caches git2 `Repository` handles to avoid re-opening them on every command.
///
/// Since `Repository` is `Send` but not `Sync`, the entire map is guarded by a
/// single `Mutex`. For a single-user desktop app with sequential polling this is
/// sufficient — all operations for the same repo would serialize anyway.
pub struct RepoCache {
    repos: Mutex<HashMap<String, Repository>>,
}

impl RepoCache {
    pub fn new() -> Self {
        Self {
            repos: Mutex::new(HashMap::new()),
        }
    }

    /// Run `f` with a cached `&Repository` for `path`, opening it on first access.
    ///
    /// If the repository's working directory no longer exists on disk the cached
    /// entry is evicted before attempting a fresh open.
    pub fn with_repo<F, R>(&self, path: &str, f: F) -> Result<R, String>
    where
        F: FnOnce(&Repository) -> Result<R, String>,
    {
        let mut repos = self
            .repos
            .lock()
            .map_err(|_| "Repository cache lock poisoned".to_string())?;

        // Evict stale entries whose workdir has been deleted.
        if repos.contains_key(path) {
            let stale = repos
                .get(path)
                .and_then(|r| r.workdir())
                .is_some_and(|wd| !wd.exists());
            if stale {
                repos.remove(path);
            }
        }

        if !repos.contains_key(path) {
            let repo = Repository::open(path)
                .map_err(|e| format!("Failed to open repository: {}", e))?;
            repos.insert(path.to_string(), repo);
        }

        let repo = repos.get(path).expect("just inserted");
        f(repo)
    }

    /// Remove a cached entry (e.g. when the user removes a repo from the app).
    #[allow(dead_code)]
    pub fn evict(&self, path: &str) {
        if let Ok(mut repos) = self.repos.lock() {
            repos.remove(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use tempfile::TempDir;

    fn create_test_repo() -> TempDir {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path();

        Command::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .expect("Failed to init git repo");

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

        temp_dir
    }

    #[test]
    fn test_with_repo_opens_and_caches() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();
        let cache = RepoCache::new();

        // First call opens the repo.
        let branch = cache
            .with_repo(path, |repo| {
                let head = repo.head().map_err(|e| e.to_string())?;
                Ok(head.shorthand().unwrap_or("").to_string())
            })
            .expect("should succeed");

        assert!(!branch.is_empty());

        // Second call reuses the cached handle (no way to observe this
        // directly, but it shouldn't error).
        let branch2 = cache
            .with_repo(path, |repo| {
                let head = repo.head().map_err(|e| e.to_string())?;
                Ok(head.shorthand().unwrap_or("").to_string())
            })
            .expect("should succeed on second call");

        assert_eq!(branch, branch2);
    }

    #[test]
    fn test_with_repo_invalid_path_returns_error() {
        let cache = RepoCache::new();
        let result = cache.with_repo("/nonexistent/path", |_repo| Ok(()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to open repository"));
    }

    #[test]
    fn test_evict_removes_cached_entry() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap();
        let cache = RepoCache::new();

        // Populate cache.
        cache
            .with_repo(path, |_repo| Ok(()))
            .expect("should succeed");

        // Evict.
        cache.evict(path);

        // Next call should re-open (still succeeds because the repo is on disk).
        cache
            .with_repo(path, |_repo| Ok(()))
            .expect("should succeed after evict");
    }

    #[test]
    fn test_stale_entry_evicted_when_workdir_deleted() {
        let temp_dir = create_test_repo();
        let path = temp_dir.path().to_str().unwrap().to_string();
        let cache = RepoCache::new();

        // Populate cache.
        cache
            .with_repo(&path, |_repo| Ok(()))
            .expect("should succeed");

        // Delete the repo from disk.
        drop(temp_dir);

        // Next call should detect the stale entry, evict, and fail to re-open.
        let result = cache.with_repo(&path, |_repo| Ok(()));
        assert!(result.is_err());
    }
}
