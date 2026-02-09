import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
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
