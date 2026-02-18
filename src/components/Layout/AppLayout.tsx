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

// Outer group: sidebar | right-content (stable across all modes)
const OUTER_LAYOUT_ID = "main-layout";
const OUTER_PANEL_IDS = ["sidebar", "right-content"] as const;

// Inner group (inside right-content): file-list | diff-view (history) or diff-view (changes)
const INNER_LAYOUT_ID = "content-layout";
const INNER_PANEL_IDS = ["file-list", "diff-view"] as const;

// Custom storage for panel layout persistence
const layoutStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

const separatorClassName = cn(
  "w-px bg-panel-border hover:bg-accent-primary/50",
  "transition-colors duration-150",
  "data-[active]:bg-accent-primary",
  "focus:outline-none"
);

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

interface BeforeMaximizeLayouts {
  outer: Record<string, number> | null;
  inner: Record<string, number> | null;
}

function captureGroupLayouts(
  outerGroup: GroupImperativeHandle | null,
  innerGroup: GroupImperativeHandle | null
): BeforeMaximizeLayouts {
  try {
    return {
      outer: outerGroup?.getLayout() ?? null,
      inner: innerGroup?.getLayout() ?? null,
    };
  } catch {
    return { outer: null, inner: null };
  }
}

function applyGroupLayouts(
  outerGroup: GroupImperativeHandle | null,
  innerGroup: GroupImperativeHandle | null,
  layouts: BeforeMaximizeLayouts
) {
  try {
    if (layouts.outer) {
      outerGroup?.setLayout(layouts.outer);
    }
  } catch {
    // Group panel structure can briefly differ during view-mode transitions.
  }
  try {
    if (layouts.inner) {
      innerGroup?.setLayout(layouts.inner);
    }
  } catch {
    // Group panel structure can briefly differ during view-mode transitions.
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
          Can't show a diff for non-consecutive commits.
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

  const shouldTrackCommitOrdering =
    viewMode === "history" && selectedCommitIds.length > 1;

  const {
    commits,
    isLoading: isLoadingCommits,
    error: commitsError,
  } = useCommits(selectedRepo, shouldTrackCommitOrdering);

  // Outer layout: sidebar | right-content — structure never changes, so
  // sidebar width is naturally preserved across History/Changes mode switches.
  const {
    defaultLayout: outerDefaultLayout,
    onLayoutChanged: outerOnLayoutChanged,
  } = useDefaultLayout({
    id: OUTER_LAYOUT_ID,
    panelIds: [...OUTER_PANEL_IDS],
    storage: layoutStorage,
  });

  // Inner layout: file-list | diff-view — persisted separately from the outer layout.
  const {
    defaultLayout: innerDefaultLayout,
    onLayoutChanged: innerOnLayoutChanged,
  } = useDefaultLayout({
    id: INNER_LAYOUT_ID,
    panelIds: [...INNER_PANEL_IDS],
    storage: layoutStorage,
  });

  const outerGroupRef = useRef<GroupImperativeHandle>(null);
  const innerGroupRef = useRef<GroupImperativeHandle>(null);
  const sidebarPanelRef = useRef<PanelImperativeHandle>(null);
  const fileListPanelRef = useRef<PanelImperativeHandle>(null);
  const collapsedBeforeMaximizeRef = useRef<CollapsedPanelsSnapshot>({
    sidebar: false,
    fileList: false,
  });
  const layoutBeforeMaximizeRef = useRef<BeforeMaximizeLayouts | null>(null);
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

  // File list is shown in the inner group only in history mode with a valid selection.
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
        layoutBeforeMaximizeRef.current = captureGroupLayouts(
          outerGroupRef.current,
          innerGroupRef.current
        );
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

    const savedLayouts = layoutBeforeMaximizeRef.current;
    if (savedLayouts) {
      applyGroupLayouts(
        outerGroupRef.current,
        innerGroupRef.current,
        savedLayouts
      );
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

      {/* Outer group: sidebar | right-content */}
      <Group
        className="flex-1"
        defaultLayout={outerDefaultLayout}
        groupRef={outerGroupRef}
        onLayoutChanged={outerOnLayoutChanged}
        orientation="horizontal"
      >
        <Panel
          collapsedSize="0px"
          collapsible
          defaultSize="20%"
          id="sidebar"
          minSize="100px"
          panelRef={sidebarPanelRef}
        >
          <FocusProvider region="sidebar">
            <Sidebar className="h-full" />
          </FocusProvider>
        </Panel>

        <Separator className={separatorClassName} />

        {/* Right-content panel: always present, contains the inner group */}
        <Panel defaultSize="80%" id="right-content" minSize="30%">
          {/* Inner group: file-list | diff-view (history) or diff-view (changes) */}
          <Group
            className="h-full"
            defaultLayout={innerDefaultLayout}
            groupRef={innerGroupRef}
            onLayoutChanged={innerOnLayoutChanged}
            orientation="horizontal"
          >
            {/* File list panel — only in history mode with a valid selection */}
            {showFileList && (
              <>
                <Panel
                  collapsedSize="0px"
                  collapsible
                  defaultSize="30%"
                  id="file-list"
                  minSize="100px"
                  panelRef={fileListPanelRef}
                >
                  <FocusProvider region="files">
                    <FileList className="h-full" />
                  </FocusProvider>
                </Panel>

                <Separator className={separatorClassName} />
              </>
            )}

            {/* Diff panel — always present in the inner group */}
            <Panel defaultSize="70%" id="diff-view" minSize="30%">
              {hasNonConsecutiveSelection ? (
                <NonConsecutiveCommitsState />
              ) : (
                <FocusProvider region="diff">
                  <DiffView className="h-full" />
                </FocusProvider>
              )}
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
