import { cn } from "../../lib/utils";

export interface FileListProps {
  className?: string;
}

export function FileList({ className }: FileListProps) {
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
        <h2 className="text-sm font-semibold text-text-primary">
          Changed Files
        </h2>
        <span className="ml-2 text-xs text-text-secondary">(5 files)</span>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {/* Placeholder file list */}
        <div className="space-y-0.5">
          {[
            { name: "src/App.tsx", status: "modified" },
            { name: "src/components/Button.tsx", status: "added" },
            { name: "src/utils/helpers.ts", status: "modified" },
            { name: "src/styles/main.css", status: "deleted" },
            { name: "package.json", status: "modified" },
          ].map((file, i) => (
            <div
              key={file.name}
              className={cn(
                "px-2 py-1.5 rounded cursor-pointer flex items-center gap-2",
                "hover:bg-bg-hover",
                i === 0 && "bg-accent-muted"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  file.status === "added" && "bg-success",
                  file.status === "modified" && "bg-warning",
                  file.status === "deleted" && "bg-danger"
                )}
              />
              <span className="text-sm text-text-primary truncate">
                {file.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
