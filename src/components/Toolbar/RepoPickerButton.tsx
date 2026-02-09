import {
  Content,
  Item,
  Portal,
  Root,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";
import { useAppStore, useRepos, useSelectedRepo } from "../../store";

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
                "flex items-center gap-2 px-3 py-2 text-sm",
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
              <span>{repo.name}</span>
            </Item>
          ))}
        </Content>
      </Portal>
    </Root>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Chevron down</title>
      <path
        clipRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Check</title>
      <path
        clipRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        fillRule="evenodd"
      />
    </svg>
  );
}
