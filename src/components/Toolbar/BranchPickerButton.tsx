import {
  Content,
  Item,
  Portal,
  Root,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { checkoutBranch, listBranches } from "../../api/commands";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useCurrentBranchName,
  useSelectedRepo,
} from "../../store";
import { useToastStore } from "../../store/toastStore";
import type { Branch } from "../../types/branch";

export interface BranchPickerButtonProps {
  className?: string;
}

export function BranchPickerButton({ className }: BranchPickerButtonProps) {
  const selectedRepo = useSelectedRepo();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const currentBranchName = useCurrentBranchName();
  const addToast = useToastStore((state) => state.addToast);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Use store's currentBranchName (polled), falling back to local branch list
  const displayBranchName =
    currentBranchName ?? branches.find((b) => b.is_current)?.name;

  // Fetch branches list (with loading indicator for initial/explicit fetches)
  const fetchBranches = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedRepo) {
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }
      try {
        const result = await listBranches(selectedRepo.path);
        setBranches(result);
      } catch (err) {
        if (!silent) {
          const message = err instanceof Error ? err.message : String(err);
          addToast({ message });
          setBranches([]);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [selectedRepo, addToast]
  );

  // Fetch branches on repo change
  useEffect(() => {
    if (selectedRepo) {
      fetchBranches();
    } else {
      setBranches([]);
    }
  }, [selectedRepo, fetchBranches]);

  // Refresh branches when dropdown opens (silent — don't disable existing items)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      useAppStore.getState().setOverlayOpen(open);
      if (open) {
        // Defer the refresh so the dropdown is fully interactive before state updates
        queueMicrotask(() => {
          fetchBranches({ silent: true });
        });
      }
    },
    [fetchBranches]
  );

  const handleBranchSelect = async (branchName: string) => {
    if (!selectedRepo || branchName === displayBranchName) {
      return;
    }

    setIsLoading(true);
    try {
      await checkoutBranch(selectedRepo.path, branchName);
      // Refresh branches to update current
      await fetchBranches();
      // Clear commit selection since we're on a new branch
      selectCommit(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast({ message });
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
    <Root onOpenChange={handleOpenChange} open={isOpen}>
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
          <span>{displayBranchName ?? "Select branch"}</span>
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
          {isLoading && localBranches.length === 0 && (
            <div className="px-3 py-2 text-sm text-text-secondary">
              Loading...
            </div>
          )}

          {!isLoading && localBranches.length === 0 && (
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
