import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { cn } from "../../lib/utils";
import { Toolbar } from "./Toolbar";
import { Sidebar } from "./Sidebar";
import { FileList } from "./FileList";
import { DiffView } from "./DiffView";

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
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: LAYOUT_ID,
    panelIds: [...PANEL_IDS],
    storage: layoutStorage,
  });

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
        {/* Sidebar - Commits Panel */}
        <Panel
          id="sidebar"
          defaultSize="20%"
          minSize="15%"
          maxSize="35%"
          collapsible
          collapsedSize="0px"
        >
          <Sidebar className="h-full border-r border-panel-border" />
        </Panel>

        <Separator
          className={cn(
            "w-1 bg-transparent hover:bg-accent-primary/50",
            "transition-colors duration-150",
            "data-[active]:bg-accent-primary"
          )}
        />

        {/* File List Panel */}
        <Panel
          id="file-list"
          defaultSize="25%"
          minSize="15%"
          maxSize="40%"
          collapsible
          collapsedSize="0px"
        >
          <FileList className="h-full border-r border-panel-border" />
        </Panel>

        <Separator
          className={cn(
            "w-1 bg-transparent hover:bg-accent-primary/50",
            "transition-colors duration-150",
            "data-[active]:bg-accent-primary"
          )}
        />

        {/* Diff View Panel */}
        <Panel
          id="diff-view"
          defaultSize="55%"
          minSize="30%"
        >
          <DiffView className="h-full" />
        </Panel>
      </Group>
    </div>
  );
}
