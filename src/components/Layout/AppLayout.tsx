import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { cn } from "../../lib/utils";
import { Toolbar } from "./Toolbar";
import { Sidebar } from "./Sidebar";
import { FileList } from "./FileList";
import { DiffView } from "./DiffView";
import { useViewMode } from "../../store/appStore";

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
        "h-screen w-screen flex flex-col",
        "bg-bg-primary text-text-primary",
        className
      )}
    >
      <Toolbar />

      <Group
        orientation="horizontal"
        className="flex-1"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        {/* Sidebar - Commits/Changes Panel */}
        <Panel
          id="sidebar"
          defaultSize="20%"
          minSize="15%"
          maxSize="35%"
          collapsible
          collapsedSize="0px"
        >
          <Sidebar className="h-full" />
        </Panel>

        <Separator
          className={cn(
            "w-px bg-panel-border hover:bg-accent-primary/50",
            "transition-colors duration-150",
            "data-[active]:bg-accent-primary"
          )}
        />

        {/* File List Panel - only visible in history mode */}
        {showFileList && (
          <>
            <Panel
              id="file-list"
              defaultSize="25%"
              minSize="15%"
              maxSize="40%"
              collapsible
              collapsedSize="0px"
            >
              <FileList className="h-full" />
            </Panel>

            <Separator
              className={cn(
                "w-px bg-panel-border hover:bg-accent-primary/50",
                "transition-colors duration-150",
                "data-[active]:bg-accent-primary"
              )}
            />
          </>
        )}

        {/* Diff View Panel */}
        <Panel
          id="diff-view"
          defaultSize={showFileList ? "55%" : "80%"}
          minSize="30%"
        >
          <DiffView className="h-full" />
        </Panel>
      </Group>
    </div>
  );
}
