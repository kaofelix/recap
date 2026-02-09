import {
  CheckIcon,
  ChevronDownIcon,
  TrashIcon,
} from "@heroicons/react/20/solid";
import {
  Action as AlertDialogAction,
  Cancel as AlertDialogCancel,
  Content as AlertDialogContent,
  Description as AlertDialogDescription,
  Overlay as AlertDialogOverlay,
  Portal as AlertDialogPortal,
  Root as AlertDialogRoot,
  Title as AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";
import {
  Content,
  Item,
  Portal,
  Root,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useAppStore, useRepos, useSelectedRepo } from "../../store";
import type { Repository } from "../../types/repository";

export interface RepoPickerButtonProps {
  className?: string;
}

export function RepoPickerButton({ className }: RepoPickerButtonProps) {
  const repos = useRepos();
  const selectedRepo = useSelectedRepo();
  const selectRepo = useAppStore((state) => state.selectRepo);
  const removeRepo = useAppStore((state) => state.removeRepo);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);

  // Don't render if no repos
  if (repos.length === 0) {
    return null;
  }

  return (
    <>
      <Root>
        <Trigger asChild>
          <button
            aria-label="Select repository"
            className={cn(
              "flex items-center gap-2 rounded px-3 py-1 text-sm",
              "bg-bg-secondary hover:bg-bg-hover",
              "border border-border-primary",
              "text-text-primary",
              "transition-colors",
              className
            )}
            type="button"
          >
            <span>{selectedRepo?.name ?? "Select repo"}</span>
            <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
          </button>
        </Trigger>

        <Portal>
          <Content
            align="start"
            className={cn(
              "min-w-[180px] rounded-md py-1 shadow-lg",
              "border border-border-primary bg-bg-primary",
              "fade-in-0 zoom-in-95 animate-in",
              "z-50"
            )}
            sideOffset={4}
          >
            {repos.map((repo) => (
              <Item
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 text-sm",
                  "text-text-primary",
                  "cursor-pointer outline-none",
                  "hover:bg-bg-hover focus:bg-bg-hover",
                  "transition-colors"
                )}
                key={repo.id}
                onSelect={() => selectRepo(repo.id)}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {repo.id === selectedRepo?.id && (
                    <CheckIcon className="h-4 w-4 text-accent-primary" />
                  )}
                </span>
                <span className="flex-1">{repo.name}</span>
                <button
                  aria-label={`Remove ${repo.name}`}
                  className="p-1 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRepoToDelete(repo);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRepoToDelete(repo);
                  }}
                  type="button"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </Item>
            ))}
          </Content>
        </Portal>
      </Root>

      <AlertDialogRoot
        onOpenChange={(open) => !open && setRepoToDelete(null)}
        open={repoToDelete !== null}
      >
        <AlertDialogPortal>
          <AlertDialogOverlay className="fixed inset-0 bg-black/50" />
          <AlertDialogContent
            aria-label="Remove repository"
            className={cn(
              "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              "w-[90vw] max-w-md rounded-lg p-6",
              "border border-border-primary bg-bg-primary shadow-lg"
            )}
          >
            <AlertDialogTitle className="font-semibold text-lg text-text-primary">
              Remove repository
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-sm text-text-secondary">
              Remove "{repoToDelete?.name}" from Recap? The repository will not
              be deleted from disk.
            </AlertDialogDescription>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialogCancel asChild>
                <button
                  className={cn(
                    "rounded px-4 py-2 text-sm",
                    "bg-bg-secondary hover:bg-bg-hover",
                    "text-text-primary"
                  )}
                  type="button"
                >
                  Cancel
                </button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <button
                  className={cn(
                    "rounded px-4 py-2 text-sm",
                    "bg-red-600 hover:bg-red-700",
                    "text-white"
                  )}
                  onClick={() => {
                    if (repoToDelete) {
                      removeRepo(repoToDelete.id);
                    }
                  }}
                  type="button"
                >
                  Remove
                </button>
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialogPortal>
      </AlertDialogRoot>
    </>
  );
}
