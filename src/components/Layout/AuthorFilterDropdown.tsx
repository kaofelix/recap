import {
  CheckboxItem,
  Content,
  ItemIndicator,
  Portal,
  Root,
  Separator,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";
import { cn } from "../../lib/utils";
import { useAppStore, useAuthorFilter } from "../../store/appStore";
import type { Commit } from "../../types/commit";

export interface AuthorFilterDropdownProps {
  commits: Commit[];
}

interface UniqueAuthor {
  name: string;
  email: string;
}

function getUniqueAuthors(commits: Commit[]): UniqueAuthor[] {
  const seen = new Map<string, UniqueAuthor>();
  for (const commit of commits) {
    if (!seen.has(commit.email)) {
      seen.set(commit.email, { name: commit.author, email: commit.email });
    }
  }
  // Sort alphabetically by name
  return [...seen.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function AuthorFilterDropdown({ commits }: AuthorFilterDropdownProps) {
  const authorFilter = useAuthorFilter();
  const toggleAuthorFilter = useAppStore((state) => state.toggleAuthorFilter);
  const clearAuthorFilter = useAppStore((state) => state.clearAuthorFilter);

  const uniqueAuthors = useMemo(() => getUniqueAuthors(commits), [commits]);
  const hasActiveFilter = authorFilter.length > 0;

  const handleClear = useCallback(
    (e: Event) => {
      e.preventDefault();
      clearAuthorFilter();
    },
    [clearAuthorFilter]
  );

  return (
    <Root>
      <Trigger asChild>
        <button
          className={cn(
            "flex items-center justify-center rounded px-1.5 py-0.5",
            "text-[10px] transition-colors",
            hasActiveFilter
              ? "bg-accent-primary/20 text-accent-primary"
              : "text-text-secondary hover:text-text-primary"
          )}
          data-testid="author-filter-button"
          title="Filter by author"
          type="button"
        >
          {hasActiveFilter ? `✦ ${authorFilter.length}` : "✦"}
        </button>
      </Trigger>

      <Portal>
        <Content
          align="end"
          className={cn(
            "max-h-[300px] min-w-[180px] overflow-y-auto rounded-md py-1 shadow-lg",
            "border border-border-primary bg-bg-primary",
            "fade-in-0 zoom-in-95 animate-in",
            "z-50"
          )}
          sideOffset={4}
        >
          {hasActiveFilter && (
            <>
              <CheckboxItem
                checked={false}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm",
                  "text-text-secondary",
                  "cursor-pointer outline-none",
                  "hover:bg-bg-hover focus:bg-bg-hover",
                  "transition-colors"
                )}
                onSelect={handleClear}
              >
                Clear filter
              </CheckboxItem>
              <Separator className="my-1 h-px bg-border-primary" />
            </>
          )}

          {uniqueAuthors.map((author) => {
            const isSelected = authorFilter.includes(author.email);
            return (
              <CheckboxItem
                checked={isSelected}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm",
                  "cursor-pointer outline-none",
                  "hover:bg-bg-hover focus:bg-bg-hover",
                  "transition-colors",
                  isSelected ? "text-text-primary" : "text-text-secondary"
                )}
                key={author.email}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleAuthorFilter(author.email);
                }}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  <ItemIndicator>
                    <Check className="h-4 w-4 text-accent-primary" />
                  </ItemIndicator>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{author.name}</span>
                  <span className="truncate text-[10px] text-text-secondary">
                    {author.email}
                  </span>
                </span>
              </CheckboxItem>
            );
          })}
        </Content>
      </Portal>
    </Root>
  );
}
