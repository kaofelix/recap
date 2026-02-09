import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
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

      // Add to store (auto-selects the new repo)
      addRepo(repoInfo.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      aria-label="Add repository"
      className={cn(
        "rounded px-3 py-1 text-sm",
        "bg-accent-primary hover:bg-accent-hover",
        "font-medium text-white",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors",
        className
      )}
      disabled={isLoading}
      onClick={handleClick}
      type="button"
    >
      {isLoading ? "Adding..." : "Add Repo"}
    </button>
  );
}
