import {
  Item,
  Portal,
  Separator,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import {
  Content as TooltipContent,
  Portal as TooltipPortal,
  Provider as TooltipProvider,
  Root as TooltipRoot,
  Trigger as TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { Check, ChevronDown, FolderGit2, GitBranch } from "lucide-react";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  checkoutBranch,
  listBranches,
  listWorktrees,
} from "../../api/commands";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useCurrentBranchName,
  useSelectedRepo,
} from "../../store";
import { useToastStore } from "../../store/toastStore";
import type { Branch } from "../../types/branch";
import type { WorktreeInfo } from "../../types/worktree";
import { DropdownMenu, DropdownMenuContent } from "../DropdownMenu";

export interface BranchPickerButtonProps {
  className?: string;
}

function getPathDisplayName(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/");
  return segments.at(-1) || path;
}

function abbreviateHomePath(path: string): string {
  return path
    .replace(/^\/Users\/[^/]+(?=\/|$)/, "~")
    .replace(/^\/home\/[^/]+(?=\/|$)/, "~")
    .replace(/^[A-Za-z]:\\Users\\[^\\]+(?=\\|$)/, "~");
}

function isLatestRequest(
  latestRepoPathRef: MutableRefObject<string | null>,
  requestIdRef: MutableRefObject<number>,
  repoPath: string,
  requestId: number
): boolean {
  return (
    latestRepoPathRef.current === repoPath && requestIdRef.current === requestId
  );
}

function beginRequest(requestIdRef: MutableRefObject<number>): number {
  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;
  return requestId;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadPickerData<T>({
  repoPath,
  latestRepoPathRef,
  requestIdRef,
  request,
  onSuccess,
  onError,
  onSettled,
}: {
  repoPath: string;
  latestRepoPathRef: MutableRefObject<string | null>;
  requestIdRef: MutableRefObject<number>;
  request: (repoPath: string) => Promise<T>;
  onSuccess: (result: T) => void;
  onError: (error: unknown) => void;
  onSettled?: (isLatest: boolean) => void;
}): Promise<void> {
  const requestId = beginRequest(requestIdRef);
  const isCurrentRequest = () =>
    isLatestRequest(latestRepoPathRef, requestIdRef, repoPath, requestId);

  try {
    const result = await request(repoPath);
    if (!isCurrentRequest()) {
      return;
    }
    onSuccess(result);
  } catch (error) {
    if (!isCurrentRequest()) {
      return;
    }
    onError(error);
  } finally {
    onSettled?.(isCurrentRequest());
  }
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof FolderGit2;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-2 pb-1 font-semibold text-[10px] text-text-secondary/70 uppercase tracking-wide">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

export function BranchPickerButton({ className }: BranchPickerButtonProps) {
  const selectedRepo = useSelectedRepo();
  const currentBranchName = useCurrentBranchName();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const selectRepoWorktree = useAppStore((state) => state.selectRepoWorktree);
  const addToast = useToastStore((state) => state.addToast);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const latestRepoPathRef = useRef<string | null>(selectedRepo?.path ?? null);
  const branchesRequestIdRef = useRef(0);
  const worktreesRequestIdRef = useRef(0);

  useEffect(() => {
    latestRepoPathRef.current = selectedRepo?.path ?? null;
  }, [selectedRepo?.path]);

  const getWorktreeName = useCallback(
    (path: string) =>
      worktrees.find((worktree) => worktree.path === path)?.name ??
      getPathDisplayName(path),
    [worktrees]
  );

  const primaryWorktree = useMemo(
    () => worktrees.find((worktree) => worktree.is_main) ?? null,
    [worktrees]
  );

  const primaryWorktreePath =
    primaryWorktree?.path ??
    selectedRepo?.canonicalPath ??
    selectedRepo?.path ??
    null;

  const linkedWorktrees = useMemo(
    () => worktrees.filter((worktree) => !worktree.is_main),
    [worktrees]
  );

  const selectedWorktree = useMemo(() => {
    if (!selectedRepo) {
      return null;
    }

    return (
      worktrees.find((worktree) => worktree.path === selectedRepo.path) ?? null
    );
  }, [selectedRepo, worktrees]);

  const localBranches = useMemo(
    () => branches.filter((branch) => !branch.is_remote),
    [branches]
  );

  const currentLocalBranch = useMemo(
    () => localBranches.find((branch) => branch.is_current) ?? null,
    [localBranches]
  );

  const displayBranchName =
    currentBranchName ?? currentLocalBranch?.name ?? null;
  const isPrimaryContext = useMemo(() => {
    if (!(selectedRepo && primaryWorktreePath)) {
      return true;
    }

    if (selectedWorktree) {
      return selectedWorktree.is_main;
    }

    if (linkedWorktrees.length === 0) {
      return true;
    }

    return selectedRepo.canonicalPath === primaryWorktreePath;
  }, [
    linkedWorktrees.length,
    primaryWorktreePath,
    selectedRepo,
    selectedWorktree,
  ]);

  const activeWorktreeName = useMemo(() => {
    if (!selectedRepo) {
      return null;
    }

    return getWorktreeName(selectedRepo.path);
  }, [getWorktreeName, selectedRepo]);

  const branchItems = useMemo(
    () =>
      localBranches.filter((branch) => {
        const worktreePath = branch.checked_out_worktree_path;
        return !worktreePath || worktreePath === primaryWorktreePath;
      }),
    [localBranches, primaryWorktreePath]
  );

  const selectedLinkedWorktreePath =
    selectedWorktree && !selectedWorktree.is_main
      ? selectedWorktree.path
      : null;

  const fetchBranches = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedRepo) {
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      await loadPickerData({
        repoPath: selectedRepo.path,
        latestRepoPathRef,
        requestIdRef: branchesRequestIdRef,
        request: listBranches,
        onSuccess: setBranches,
        onError: (error) => {
          if (!silent) {
            addToast({ message: getErrorMessage(error) });
          }
          setBranches([]);
        },
        onSettled: (isLatest) => {
          if (!silent && isLatest) {
            setIsLoading(false);
          }
        },
      });
    },
    [selectedRepo, addToast]
  );

  const fetchWorktrees = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedRepo) {
        return;
      }

      await loadPickerData({
        repoPath: selectedRepo.path,
        latestRepoPathRef,
        requestIdRef: worktreesRequestIdRef,
        request: listWorktrees,
        onSuccess: setWorktrees,
        onError: (error) => {
          if (!silent) {
            addToast({ message: getErrorMessage(error) });
          }
          setWorktrees([]);
        },
      });
    },
    [selectedRepo, addToast]
  );

  const fetchBranchPickerData = useCallback(
    async ({ silent = false } = {}) => {
      await Promise.all([
        fetchBranches({ silent }),
        fetchWorktrees({ silent }),
      ]);
    },
    [fetchBranches, fetchWorktrees]
  );

  useEffect(() => {
    if (selectedRepo) {
      setBranches([]);
      setWorktrees([]);
      fetchBranchPickerData().catch(() => undefined);
    } else {
      setBranches([]);
      setWorktrees([]);
    }
  }, [selectedRepo, fetchBranchPickerData]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open) {
        queueMicrotask(() => {
          fetchBranchPickerData({ silent: true }).catch(() => undefined);
        });
      }
    },
    [fetchBranchPickerData]
  );

  const handleBranchSelect = async (branch: Branch) => {
    if (!selectedRepo || branch.is_current) {
      return;
    }

    const targetWorktreePath = branch.checked_out_worktree_path;
    if (targetWorktreePath && targetWorktreePath !== selectedRepo.path) {
      selectRepoWorktree(selectedRepo.id, targetWorktreePath);
      selectCommit(null);
      return;
    }

    const checkoutPath =
      !(targetWorktreePath || isPrimaryContext) && primaryWorktreePath
        ? primaryWorktreePath
        : selectedRepo.path;

    if (checkoutPath !== selectedRepo.path) {
      selectRepoWorktree(selectedRepo.id, checkoutPath);
    }

    setIsLoading(true);
    try {
      await checkoutBranch(checkoutPath, branch.name);
      await fetchBranchPickerData();
      selectCommit(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast({ message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorktreeSelect = (path: string) => {
    if (!selectedRepo || path === selectedRepo.path) {
      return;
    }

    selectRepoWorktree(selectedRepo.id, path);
  };

  if (!selectedRepo) {
    return null;
  }

  const hasWorktreeItems = linkedWorktrees.length > 0;
  const hasBranchItems = branchItems.length > 0;
  const triggerLabel = isPrimaryContext
    ? (displayBranchName ?? getPathDisplayName(selectedRepo.path))
    : (activeWorktreeName ?? getPathDisplayName(selectedRepo.path));
  const TriggerIcon = isPrimaryContext ? GitBranch : FolderGit2;

  const triggerButton = (
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
      <TriggerIcon className="h-4 w-4 text-text-secondary" />
      <span>{triggerLabel}</span>
      <ChevronDown className="h-4 w-4 text-text-secondary" />
    </button>
  );

  return (
    <DropdownMenu onOpenChange={handleOpenChange} open={isOpen}>
      <TooltipProvider delayDuration={1000}>
        <TooltipRoot>
          <TooltipTrigger asChild>
            <Trigger asChild>{triggerButton}</Trigger>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              className={cn(
                "z-50 rounded px-2 py-1 text-xs",
                "bg-bg-tertiary text-text-primary",
                "border border-panel-border shadow-lg",
                "fade-in-0 zoom-in-95 animate-in duration-100"
              )}
              sideOffset={5}
            >
              {abbreviateHomePath(selectedRepo.path)}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </TooltipProvider>

      <Portal>
        <DropdownMenuContent
          align="start"
          className={cn(
            "max-h-[320px] min-w-[280px] overflow-y-auto rounded-md py-1 shadow-lg",
            "border border-border-primary bg-bg-primary",
            "fade-in-0 zoom-in-95 animate-in",
            "z-50"
          )}
          sideOffset={4}
        >
          {isLoading && !hasWorktreeItems && !hasBranchItems && (
            <div className="px-3 py-2 text-sm text-text-secondary">
              Loading...
            </div>
          )}

          {!(isLoading || hasWorktreeItems || hasBranchItems) && (
            <div className="px-3 py-2 text-sm text-text-secondary">
              No branches or worktrees found
            </div>
          )}

          {hasWorktreeItems && (
            <>
              <SectionLabel icon={FolderGit2}>Worktrees</SectionLabel>
              {linkedWorktrees.map((worktree) => (
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
                  key={worktree.path}
                  onSelect={() => handleWorktreeSelect(worktree.path)}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {worktree.path === selectedLinkedWorktreePath && (
                      <Check className="h-4 w-4 text-accent-primary" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {worktree.name}
                  </span>
                  <span className="max-w-[180px] truncate text-right text-text-secondary text-xs">
                    {abbreviateHomePath(worktree.path)}
                  </span>
                </Item>
              ))}
            </>
          )}

          {hasWorktreeItems && hasBranchItems && (
            <Separator className="my-0.5 h-px bg-border-primary" />
          )}

          {hasBranchItems && (
            <>
              <SectionLabel icon={GitBranch}>Branches</SectionLabel>
              {branchItems.map((branch) => (
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
                  onSelect={() => handleBranchSelect(branch)}
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {branch.is_current && isPrimaryContext && (
                      <Check className="h-4 w-4 text-accent-primary" />
                    )}
                  </span>
                  <span className="truncate">{branch.name}</span>
                </Item>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </Portal>
    </DropdownMenu>
  );
}
