import { cn } from "../../lib/utils";

export interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <div
      className={cn(
        "h-full flex flex-col",
        "bg-panel-bg",
        className
      )}
    >
      <div
        className={cn(
          "h-10 flex items-center px-3",
          "border-b border-panel-border",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="text-sm font-semibold text-text-primary">Commits</h2>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {/* Placeholder commit list */}
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                "p-2 rounded cursor-pointer",
                "hover:bg-bg-hover",
                i === 1 && "bg-accent-muted"
              )}
            >
              <div className="text-sm font-medium text-text-primary truncate">
                feat: add new feature #{i}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                abc123{i} · 2 hours ago
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
