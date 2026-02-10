import { cn } from "../../lib/utils";
import {
  AddRepoButton,
  BranchPickerButton,
  RepoPickerButton,
} from "../Toolbar";

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
        "flex h-12 items-center gap-4 px-4",
        "border-panel-border border-b bg-panel-header-bg",
        "shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-text-secondary">
          Repository:
        </span>
        <RepoPickerButton />
        <AddRepoButton onError={handleAddRepoError} />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-text-secondary">Branch:</span>
        <BranchPickerButton />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          className={cn(
            "rounded px-3 py-1 text-sm",
            "bg-accent-primary hover:bg-accent-hover",
            "font-medium text-white"
          )}
          type="button"
        >
          Refresh
        </button>
      </div>
    </header>
  );
}
