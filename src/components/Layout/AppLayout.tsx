import { GitGraph } from "lucide-react";
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
import { useCommits } from "../../hooks/useCommits";
import { useGlobalCommand } from "../../hooks/useGlobalCommand";
import { useKeyboardHandler } from "../../hooks/useKeyboardHandler";
import { defaultKeymap } from "../../keymaps/defaults";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedCommitIds,
  useSelectedRepo,
  useViewMode,
} from "../../store/appStore";
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

function isConsecutiveCommitSelection(
  selectedCommitIds: string[],
  orderedCommitIds: string[]
): boolean {
  if (selectedCommitIds.length <= 1) {
    return true;
  }

  const indexById = new Map(orderedCommitIds.map((id, index) => [id, index]));
  const indices = selectedCommitIds
    .map((id) => indexById.get(id))
    .filter((value): value is number => typeof value === "number");

  if (indices.length !== selectedCommitIds.length) {
    return true;
  }

  const min = Math.min(...indices);
  const max = Math.max(...indices);

  return max - min + 1 === selectedCommitIds.length;
}

function NonConsecutiveCommitsState() {
  return (
    <div className="flex h-full items-center justify-center bg-panel-bg px-8">
      <div className="-mt-8 flex max-w-xl flex-col items-center text-center">
        <div
          className={cn(
            "mb-6 flex h-16 w-16 items-center justify-center rounded-full",
            "border border-panel-border bg-panel-header-bg"
          )}
        >
          <GitGraph className="h-8 w-8 text-text-tertiary" />
        </div>

        <h3 className="font-semibold text-base text-text-primary leading-tight">
          Can’t show a diff for non-consecutive commits.
        </h3>
        <p className="mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
          Select one commit or a consecutive range to view changes.
        </p>
      </div>
    </div>
  );
}

export interface AppLayoutProps {
  className?: string;
}

export function AppLayout({ className }: AppLayoutProps) {
  const viewMode = useViewMode();
  const selectedRepo = useSelectedRepo();
  const selectedCommitIds = useSelectedCommitIds();
  const focusNextPanel = useAppStore((s) => s.focusNextPanel);
  const focusPrevPanel = useAppStore((s) => s.focusPrevPanel);
  const isDiffMaximized = useAppStore((s) => s.isDiffMaximized);
  const toggleDiffMaximized = useAppStore((s) => s.toggleDiffMaximized);

  const {
    commits,
    isLoading: isLoadingCommits,
    error: commitsError,
  } = useCommits(selectedRepo, viewMode === "history");

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

  const hasNonConsecutiveSelection =
    viewMode === "history" &&
    !isLoadingCommits &&
    !commitsError &&
    selectedCommitIds.length > 1 &&
    !isConsecutiveCommitSelection(
      selectedCommitIds,
      commits.map((commit) => commit.id)
    );

  // In changes mode, we hide the file list panel since the sidebar shows files directly.
  // In history mode with non-consecutive selection, we temporarily show a single
  // full-width state panel on the right.
  const showFileList = viewMode === "history" && !hasNonConsecutiveSelection;

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

        {/* Right Panel */}
        <Panel
          defaultSize={showFileList ? "55%" : "80%"}
          id="diff-view"
          minSize="30%"
        >
          {hasNonConsecutiveSelection ? (
            <NonConsecutiveCommitsState />
          ) : (
            <FocusProvider region="diff">
              <DiffView className="h-full" />
            </FocusProvider>
          )}
        </Panel>
      </Group>
    </div>
  );
}
