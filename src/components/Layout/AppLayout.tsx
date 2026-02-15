import { useEffect, useRef } from "react";
import {
  Group,
  type GroupImperativeHandle,
  Panel,
  type PanelImperativeHandle,
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

function isPanelCollapsed(panel: PanelImperativeHandle | null) {
  if (!panel) {
    return false;
  }

  try {
    return panel.isCollapsed();
  } catch {
    return false;
  }
}

function collapsePanel(panel: PanelImperativeHandle | null) {
  if (!panel) {
    return;
  }

  try {
    panel.collapse();
  } catch {
    // Panel may be temporarily unmounted while view mode switches.
  }
}

function expandPanel(panel: PanelImperativeHandle | null) {
  if (!panel) {
    return;
  }

  try {
    panel.expand();
  } catch {
    // Panel may be temporarily unmounted while view mode switches.
  }
}

interface CollapsedPanelsSnapshot {
  sidebar: boolean;
  fileList: boolean;
}

function captureCollapsedPanels(
  sidebar: PanelImperativeHandle,
  fileList: PanelImperativeHandle | null,
  showFileList: boolean
): CollapsedPanelsSnapshot {
  return {
    sidebar: isPanelCollapsed(sidebar),
    fileList: showFileList ? isPanelCollapsed(fileList) : false,
  };
}

function maximizePanels(
  sidebar: PanelImperativeHandle,
  fileList: PanelImperativeHandle | null,
  showFileList: boolean
) {
  if (!isPanelCollapsed(sidebar)) {
    collapsePanel(sidebar);
  }

  if (showFileList && fileList && !isPanelCollapsed(fileList)) {
    collapsePanel(fileList);
  }
}

function restorePanels(
  sidebar: PanelImperativeHandle,
  fileList: PanelImperativeHandle | null,
  showFileList: boolean,
  collapsedBeforeMaximize: CollapsedPanelsSnapshot
) {
  if (!collapsedBeforeMaximize.sidebar && isPanelCollapsed(sidebar)) {
    expandPanel(sidebar);
  }

  if (
    showFileList &&
    fileList &&
    !collapsedBeforeMaximize.fileList &&
    isPanelCollapsed(fileList)
  ) {
    expandPanel(fileList);
  }
}

export interface AppLayoutProps {
  className?: string;
}

export function AppLayout({ className }: AppLayoutProps) {
  const viewMode = useViewMode();
  const focusNextPanel = useAppStore((s) => s.focusNextPanel);
  const focusPrevPanel = useAppStore((s) => s.focusPrevPanel);
  const isDiffMaximized = useAppStore((s) => s.isDiffMaximized);
  const toggleDiffMaximized = useAppStore((s) => s.toggleDiffMaximized);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: LAYOUT_ID,
    panelIds: [...PANEL_IDS],
    storage: layoutStorage,
  });

  const groupRef = useRef<GroupImperativeHandle>(null);
  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const fileListPanelRef = useRef<PanelImperativeHandle>(null);
  const collapsedBeforeMaximizeRef = useRef({
    sidebar: false,
    fileList: false,
  });
  const layoutBeforeMaximizeRef = useRef<Record<string, number> | null>(null);
  const wasDiffMaximizedRef = useRef(false);

  // In changes mode, we hide the file list panel since the sidebar shows files directly
  const showFileList = viewMode === "history";

  useEffect(() => {
    const sidebar = sidebarPanelRef.current;
    const fileList = fileListPanelRef.current;

    if (!sidebar) {
      return;
    }

    if (isDiffMaximized) {
      if (!wasDiffMaximizedRef.current) {
        collapsedBeforeMaximizeRef.current = captureCollapsedPanels(
          sidebar,
          fileList,
          showFileList
        );

        try {
          layoutBeforeMaximizeRef.current =
            groupRef.current?.getLayout() ?? null;
        } catch {
          layoutBeforeMaximizeRef.current = null;
        }
      }

      maximizePanels(sidebar, fileList, showFileList);
      wasDiffMaximizedRef.current = true;
      return;
    }

    restorePanels(
      sidebar,
      fileList,
      showFileList,
      collapsedBeforeMaximizeRef.current
    );

    const layoutBeforeMaximize = layoutBeforeMaximizeRef.current;
    if (layoutBeforeMaximize) {
      try {
        groupRef.current?.setLayout(layoutBeforeMaximize);
      } catch {
        // Group panel structure can briefly differ during view-mode transitions.
      }
      layoutBeforeMaximizeRef.current = null;
    }

    wasDiffMaximizedRef.current = false;
  }, [isDiffMaximized, showFileList]);

  // Set up keyboard handler
  useKeyboardHandler(defaultKeymap);

  // Panel navigation commands
  useGlobalCommand("navigation.focusNextPanel", focusNextPanel);
  useGlobalCommand("navigation.focusPrevPanel", focusPrevPanel);
  useGlobalCommand("layout.toggleDiffMaximized", toggleDiffMaximized);

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
        groupRef={groupRef}
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
          panelRef={sidebarPanelRef}
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
              panelRef={fileListPanelRef}
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
