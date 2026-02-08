import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";

export interface RepoInfo {
  path: string;
  name: string;
  branch: string;
}

export interface AddRepoButtonProps {
  className?: string;
  onError?: (message: string) => void;
}

export function AddRepoButton({ className, onError }: AddRepoButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const addRepo = useAppStore((state) => state.addRepo);
  const selectRepo = useAppStore((state) => state.selectRepo);
  const repos = useAppStore((state) => state.repos);

  const handleClick = async () => {
    try {
      setIsLoading(true);

      // Open native folder picker
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Git Repository",
      });

      // User cancelled
      if (!selected) {
        return;
      }

      const path = typeof selected === "string" ? selected : selected[0];
      if (!path) {
        return;
      }

      // Validate with backend
      const repoInfo = await invoke<RepoInfo>("validate_repo", { path });

      // Add to store
      addRepo(repoInfo.path);

      // Find the newly added repo and select it
      // We need to get the updated repos after addRepo
      const updatedRepos = useAppStore.getState().repos;
      const newRepo = updatedRepos.find((r) => r.path === repoInfo.path);
      if (newRepo) {
        selectRepo(newRepo.id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "px-3 py-1 rounded text-sm",
        "bg-accent-primary hover:bg-accent-hover",
        "text-white font-medium",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className
      )}
      aria-label="Add repository"
    >
      {isLoading ? "Adding..." : "Add Repo"}
    </button>
  );
}
