import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  AddRepoButton,
  BranchPickerButton,
  RepoPickerButton,
  UpdaterStatus,
} from "../Toolbar";

export interface ToolbarProps {
  className?: string;
  isCommitListHidden: boolean;
  isCommitListToggleDisabled?: boolean;
  onToggleCommitList: () => void;
}

export function Toolbar({
  className,
  isCommitListHidden,
  isCommitListToggleDisabled = false,
  onToggleCommitList,
}: ToolbarProps) {
  const commitListLabel = isCommitListHidden
    ? "Show commit list"
    : "Hide commit list";
  const CommitListIcon = isCommitListHidden ? PanelLeftOpen : PanelLeftClose;

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
        <button
          aria-label={commitListLabel}
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded",
            "text-text-secondary hover:text-text-primary",
            "hover:bg-bg-hover active:bg-bg-active",
            "transition-colors duration-150",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          disabled={isCommitListToggleDisabled}
          onClick={onToggleCommitList}
          title={`${commitListLabel} (⌘[)`}
          type="button"
        >
          <CommitListIcon className="h-4 w-4" />
        </button>
        <span className="font-medium text-sm text-text-secondary">
          Repository:
        </span>
        <RepoPickerButton />
        <AddRepoButton />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-text-secondary">Branch:</span>
        <BranchPickerButton />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <UpdaterStatus />
      </div>
    </header>
  );
}
