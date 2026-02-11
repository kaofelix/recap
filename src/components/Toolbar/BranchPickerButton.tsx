import {
  Content,
  Item,
  Portal,
  Root,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { invoke } from "@tauri-apps/api/core";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import { useAppStore, useSelectedRepo } from "../../store";
import type { Branch } from "../../types/branch";

export interface BranchPickerButtonProps {
  className?: string;
}

async function listBranches(repoPath: string): Promise<Branch[]> {
  return invoke<Branch[]>("list_branches", { repoPath });
}

async function checkoutBranch(
  repoPath: string,
  branchName: string
): Promise<void> {
  return invoke<void>("checkout_branch", { repoPath, branchName });
}

export function BranchPickerButton({ className }: BranchPickerButtonProps) {
  const selectedRepo = useSelectedRepo();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBranch = branches.find((b) => b.is_current);

  // Fetch branches when dropdown opens
  const fetchBranches = useCallback(async () => {
    if (!selectedRepo) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await listBranches(selectedRepo.path);
      setBranches(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRepo]);

  // Fetch branches on repo change to get current branch name
  useEffect(() => {
    if (selectedRepo) {
      fetchBranches();
    } else {
      setBranches([]);
    }
  }, [selectedRepo, fetchBranches]);

  const handleBranchSelect = async (branchName: string) => {
    if (!selectedRepo || branchName === currentBranch?.name) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await checkoutBranch(selectedRepo.path, branchName);
      // Refresh branches to update current
      await fetchBranches();
      // Clear commit selection since we're on a new branch
      selectCommit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if no repo selected
  if (!selectedRepo) {
    return null;
  }

  // Filter to only local branches for now
  const localBranches = branches.filter((b) => !b.is_remote);

  return (
    <Root onOpenChange={setIsOpen} open={isOpen}>
      <Trigger asChild>
        <button
          aria-label="Select branch"
          className={cn(
            "flex items-center gap-2 rounded px-3 py-1 text-sm",
            "bg-bg-secondary hover:bg-bg-hover",
            "border border-border-primary",
            "text-text-primary",
            "transition-colors",
            isLoading && "opacity-50",
            className
          )}
          disabled={isLoading}
          type="button"
        >
          <span>{currentBranch?.name ?? "Select branch"}</span>
          <ChevronDown className="h-4 w-4 text-text-secondary" />
        </button>
      </Trigger>

      <Portal>
        <Content
          align="start"
          className={cn(
            "max-h-[300px] min-w-[200px] overflow-y-auto rounded-md py-1 shadow-lg",
            "border border-border-primary bg-bg-primary",
            "fade-in-0 zoom-in-95 animate-in",
            "z-50"
          )}
          sideOffset={4}
        >
          {error && (
            <div className="px-3 py-2 text-red-500 text-sm">{error}</div>
          )}

          {isLoading && localBranches.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-secondary">
              Loading...
            </div>
          )}

          {!isLoading && localBranches.length === 0 && !error && (
            <div className="px-3 py-2 text-sm text-text-secondary">
              No branches found
            </div>
          )}

          {localBranches.map((branch) => (
            <Item
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm",
                "text-text-primary",
                "cursor-pointer outline-none",
                "hover:bg-bg-hover focus:bg-bg-hover",
                "transition-colors",
                isLoading && "pointer-events-none opacity-50"
              )}
              disabled={isLoading}
              key={branch.name}
              onSelect={() => handleBranchSelect(branch.name)}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {branch.is_current && (
                  <Check className="h-4 w-4 text-accent-primary" />
                )}
              </span>
              <span className="flex-1 truncate">{branch.name}</span>
              <span className="font-mono text-text-tertiary text-xs">
                {branch.commit_id.slice(0, 7)}
              </span>
            </Item>
          ))}
        </Content>
      </Portal>
    </Root>
  );
}
