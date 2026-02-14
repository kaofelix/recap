import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { FocusProvider } from "../../context/FocusContext";
import { useGlobalCommand } from "../../hooks/useGlobalCommand";
import { useKeyboardHandler } from "../../hooks/useKeyboardHandler";
import { defaultKeymap } from "../../keymaps/defaults";
import { cn } from "../../lib/utils";
import { useAppStore, useViewMode } from "../../store/appStore";
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
  const focusNextPanel = useAppStore((s) => s.focusNextPanel);
  const focusPrevPanel = useAppStore((s) => s.focusPrevPanel);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: LAYOUT_ID,
    panelIds: [...PANEL_IDS],
    storage: layoutStorage,
  });

  // In changes mode, we hide the file list panel since the sidebar shows files directly
  const showFileList = viewMode === "history";

  // Set up keyboard handler
  useKeyboardHandler(defaultKeymap);

  // Panel navigation commands
  useGlobalCommand("navigation.focusNextPanel", focusNextPanel);
  useGlobalCommand("navigation.focusPrevPanel", focusPrevPanel);

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
          <FocusProvider region="sidebar">
            <Sidebar className="h-full" />
          </FocusProvider>
        </Panel>

        <Separator
          className={cn(
            "w-px bg-panel-border hover:bg-accent-primary/50",
            "transition-colors duration-150",
            "data-[active]:bg-accent-primary",
            "focus:outline-none"
          )}
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
              <FocusProvider region="files">
                <FileList className="h-full" />
              </FocusProvider>
            </Panel>

            <Separator
              className={cn(
                "w-px bg-panel-border hover:bg-accent-primary/50",
                "transition-colors duration-150",
                "data-[active]:bg-accent-primary",
                "focus:outline-none"
              )}
            />
          </>
        )}

        {/* Diff View Panel */}
        <Panel
          defaultSize={showFileList ? "55%" : "80%"}
          id="diff-view"
          minSize="30%"
        >
          <FocusProvider region="diff">
            <DiffView className="h-full" />
          </FocusProvider>
        </Panel>
      </Group>
    </div>
  );
}
