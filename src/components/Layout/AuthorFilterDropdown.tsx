import {
  CheckboxItem,
  Content,
  ItemIndicator,
  Portal,
  Root,
  Separator,
  Trigger,
} from "@radix-ui/react-dropdown-menu";
import { invoke } from "@tauri-apps/api/core";
import { Check, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useAuthorFilter,
  useSelectedRepo,
} from "../../store/appStore";

interface AuthorOption {
  name: string;
  email: string;
}

export function AuthorFilterDropdown() {
  const selectedRepo = useSelectedRepo();
  const selectedRepoPath = selectedRepo?.path ?? null;
  const authorFilter = useAuthorFilter();
  const toggleAuthorFilter = useAppStore((state) => state.toggleAuthorFilter);
  const clearAuthorFilter = useAppStore((state) => state.clearAuthorFilter);

  const [authors, setAuthors] = useState<AuthorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!(open && selectedRepoPath)) {
      return;
    }

    let cancelled = false;

    const loadAuthors = async () => {
      try {
        const result = await invoke<AuthorOption[]>("list_authors", {
          repoPath: selectedRepoPath,
        });
        if (!cancelled) {
          setAuthors(result);
        }
      } catch {
        if (!cancelled) {
          setAuthors([]);
        }
      }
    };

    loadAuthors();

    return () => {
      cancelled = true;
    };
  }, [open, selectedRepoPath]);

  const hasActiveFilter = authorFilter.length > 0;

  const filteredAuthors = useMemo(() => {
    if (!search.trim()) {
      return authors;
    }
    const query = search.toLowerCase();
    return authors.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.email.toLowerCase().includes(query)
    );
  }, [authors, search]);

  const handleClear = useCallback(
    (e: Event) => {
      e.preventDefault();
      clearAuthorFilter();
    },
    [clearAuthorFilter]
  );

  return (
    <Root
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
        }
      }}
      open={open}
    >
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
          <Filter className="h-3 w-3" />
          {hasActiveFilter && (
            <span className="text-[10px] leading-none">
              {authorFilter.length}
            </span>
          )}
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
          <div className="px-2 py-1.5">
            <input
              className={cn(
                "w-full rounded border border-panel-border bg-bg-primary px-2 py-1",
                "text-text-primary text-xs placeholder:text-text-secondary/50",
                "focus:border-accent-primary focus:outline-none"
              )}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search authors…"
              type="text"
              value={search}
            />
          </div>
          <Separator className="my-0.5 h-px bg-border-primary" />

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

          {filteredAuthors.map((author) => {
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
                  <span className="truncate text-text-primary">
                    {author.name}
                  </span>
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
