import { useCallback, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const authorFilter = useAuthorFilter();
  const toggleAuthorFilter = useAppStore((state) => state.toggleAuthorFilter);
  const clearAuthorFilter = useAppStore((state) => state.clearAuthorFilter);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const uniqueAuthors = getUniqueAuthors(commits);
  const hasActiveFilter = authorFilter.length > 0;

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const handleAuthorClick = useCallback(
    (email: string) => {
      toggleAuthorFilter(email);
    },
    [toggleAuthorFilter]
  );

  const handleClear = useCallback(() => {
    clearAuthorFilter();
  }, [clearAuthorFilter]);

  // Close dropdown when clicking outside
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is inside the dropdown
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(e.relatedTarget as Node)
    ) {
      setOpen(false);
    }
  }, []);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onBlur tracks focus leaving the dropdown container
    // biome-ignore lint/a11y/noStaticElementInteractions: onBlur tracks focus leaving the dropdown container
    <div className="relative" onBlur={handleBlur} ref={dropdownRef}>
      <button
        className={cn(
          "flex items-center justify-center rounded px-1.5 py-0.5",
          "text-[10px] transition-colors",
          hasActiveFilter
            ? "bg-accent-primary/20 text-accent-primary"
            : "text-text-secondary hover:text-text-primary"
        )}
        data-testid="author-filter-button"
        onClick={handleToggle}
        title="Filter by author"
        type="button"
      >
        {hasActiveFilter ? `✦ ${authorFilter.length}` : "✦"}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full right-0 z-50 mt-1 min-w-[180px]",
            "rounded border border-panel-border bg-panel-bg shadow-lg"
          )}
          data-testid="author-filter-dropdown"
        >
          {hasActiveFilter && (
            <button
              className={cn(
                "w-full px-3 py-1.5 text-left text-xs",
                "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
                "border-panel-border border-b"
              )}
              onClick={handleClear}
              type="button"
            >
              Clear filter
            </button>
          )}
          <div className="max-h-[200px] overflow-y-auto py-1">
            {uniqueAuthors.map((author) => {
              const isSelected = authorFilter.includes(author.email);
              return (
                <button
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                    "hover:bg-bg-tertiary",
                    isSelected ? "text-text-primary" : "text-text-secondary"
                  )}
                  key={author.email}
                  onClick={() => handleAuthorClick(author.email)}
                  type="button"
                >
                  <span
                    className={cn(
                      "flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-sm border",
                      isSelected
                        ? "border-accent-primary bg-accent-primary text-white"
                        : "border-text-secondary/40"
                    )}
                  >
                    {isSelected && (
                      <span className="text-[8px] leading-none">✓</span>
                    )}
                  </span>
                  <span className="truncate">{author.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
