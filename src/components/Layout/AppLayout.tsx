import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { cn } from "../../lib/utils";
import { useViewMode } from "../../store/appStore";
import { DiffView } from "./DiffView";
import { FileList } from "./FileList";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";

const PANEL_IDS = ["sidebar", "file-list", "diff-view"] as const;
const LAYOUT_ID = "main-layout";

// Custom storage for panel layout persistence
const layoutStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

export interface AppLayoutProps {
  className?: string;
}

export function AppLayout({ className }: AppLayoutProps) {
  const viewMode = useViewMode();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: LAYOUT_ID,
    panelIds: [...PANEL_IDS],
    storage: layoutStorage,
  });

  // In changes mode, we hide the file list panel since the sidebar shows files directly
  const showFileList = viewMode === "history";

  return (
    <div
      className={cn(
        "flex h-screen w-screen flex-col",
        "bg-bg-primary text-text-primary",
        className
      )}
    >
      <Toolbar />

      <Group
        className="flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        orientation="horizontal"
      >
        {/* Sidebar - Commits/Changes Panel */}
        <Panel
          collapsedSize="0px"
          collapsible
          defaultSize="20%"
          id="sidebar"
          maxSize="35%"
          minSize="15%"
        >
          <Sidebar className="h-full" />
        </Panel>

        <Separator
          className={cn(
            "w-px bg-panel-border hover:bg-accent-primary/50",
            "transition-colors duration-150",
            "data-[active]:bg-accent-primary",
            "focus:outline-none"
          )}
          tabIndex={-1}
        />

        {/* File List Panel - only visible in history mode */}
        {showFileList && (
          <>
            <Panel
              collapsedSize="0px"
              collapsible
              defaultSize="25%"
              id="file-list"
              maxSize="40%"
              minSize="15%"
            >
              <FileList className="h-full" />
            </Panel>

            <Separator
              className={cn(
                "w-px bg-panel-border hover:bg-accent-primary/50",
                "transition-colors duration-150",
                "data-[active]:bg-accent-primary",
                "focus:outline-none"
              )}
              tabIndex={-1}
            />
          </>
        )}

        {/* Diff View Panel */}
        <Panel
          defaultSize={showFileList ? "55%" : "80%"}
          id="diff-view"
          minSize="30%"
        >
          <DiffView className="h-full" />
        </Panel>
      </Group>
    </div>
  );
}
