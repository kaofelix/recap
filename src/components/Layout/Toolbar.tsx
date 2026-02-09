import { cn } from "../../lib/utils";
import { AddRepoButton, RepoPickerButton } from "../Toolbar";

export interface ToolbarProps {
  className?: string;
}

export function Toolbar({ className }: ToolbarProps) {
  const handleAddRepoError = (message: string) => {
    // TODO: Replace with toast notification
    console.error("Failed to add repository:", message);
  };

  return (
    <header
      className={cn(
        "h-12 flex items-center px-4 gap-4",
        "bg-panel-header-bg border-b border-panel-border",
        "shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-text-secondary text-sm font-medium">
          Repository:
        </span>
        <RepoPickerButton />
        <AddRepoButton onError={handleAddRepoError} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-text-secondary text-sm font-medium">Branch:</span>
        <button
          className={cn(
            "px-3 py-1 rounded text-sm",
            "bg-bg-secondary hover:bg-bg-hover",
            "border border-border-primary",
            "text-text-primary"
          )}
        >
          main
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          className={cn(
            "px-3 py-1 rounded text-sm",
            "bg-accent-primary hover:bg-accent-hover",
            "text-white font-medium"
          )}
        >
          Refresh
        </button>
      </div>
    </header>
  );
}
