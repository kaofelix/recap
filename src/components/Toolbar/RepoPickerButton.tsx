import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";
import { useRepos, useSelectedRepo, useAppStore } from "../../store";

export interface RepoPickerButtonProps {
  className?: string;
}

export function RepoPickerButton({ className }: RepoPickerButtonProps) {
  const repos = useRepos();
  const selectedRepo = useSelectedRepo();
  const selectRepo = useAppStore((state) => state.selectRepo);

  // Don't render if no repos
  if (repos.length === 0) {
    return null;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded text-sm",
            "bg-bg-secondary hover:bg-bg-hover",
            "border border-border-primary",
            "text-text-primary",
            "transition-colors",
            className
          )}
          aria-label="Select repository"
        >
          <span>{selectedRepo?.name ?? "Select repo"}</span>
          <ChevronDownIcon className="w-4 h-4 text-text-secondary" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            "min-w-[180px] py-1 rounded-md shadow-lg",
            "bg-bg-primary border border-border-primary",
            "animate-in fade-in-0 zoom-in-95",
            "z-50"
          )}
          sideOffset={4}
          align="start"
        >
          {repos.map((repo) => (
            <DropdownMenu.Item
              key={repo.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm",
                "text-text-primary",
                "cursor-pointer outline-none",
                "hover:bg-bg-hover focus:bg-bg-hover",
                "transition-colors"
              )}
              onSelect={() => selectRepo(repo.id)}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                {repo.id === selectedRepo?.id && (
                  <CheckIcon className="w-4 h-4 text-accent-primary" />
                )}
              </span>
              <span>{repo.name}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
