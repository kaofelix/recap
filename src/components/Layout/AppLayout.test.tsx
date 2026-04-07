import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../store/appStore";
import { AppLayout } from "./AppLayout";

function renderAppLayout(props?: { className?: string }) {
  return render(
    <HotkeysProvider>
      <AppLayout {...props} />
    </HotkeysProvider>
  );
}

function pressKey(key: string, options?: KeyboardEventInit) {
  fireEvent.keyDown(document, { key, ...options });
}

describe("AppLayout", () => {
  beforeEach(() => {
    // Clear any stored panel layout
    localStorage.clear();
    // Reset store state
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitIds: [],
      focusedRegion: null,
      commits: [],
      isLoadingCommits: false,
      commitsError: null,
      viewMode: "history",
      isDiffMaximized: false,
      overlayOpen: false,
    });
  });

  it("renders the toolbar", () => {
    renderAppLayout();

    expect(screen.getByText("Repository:")).toBeInTheDocument();
    expect(screen.getByText("Branch:")).toBeInTheDocument();
  });

  it("places commit list toggle button to the left of repository label", () => {
    renderAppLayout();

    const repositoryLabel = screen.getByText("Repository:");
    expect(repositoryLabel.previousElementSibling).toHaveAttribute(
      "aria-label",
      "Hide commit list"
    );
  });

  it("renders a unified history sidebar without a changes tab", () => {
    renderAppLayout();

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Changes" })
    ).not.toBeInTheDocument();
  });

  it("renders the file list panel", () => {
    renderAppLayout();

    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  it("shows empty state when no commit is selected", () => {
    renderAppLayout();

    expect(
      screen.getByText("Select a commit to view changed files")
    ).toBeInTheDocument();
  });

  it("renders the diff view panel", () => {
    renderAppLayout();

    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Split view" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unified view" })
    ).toBeInTheDocument();
  });

  it("shows empty state when no file is selected", () => {
    renderAppLayout();

    expect(screen.getByText("Select a file to view diff")).toBeInTheDocument();
  });

  it("shows empty state when no repo is selected", () => {
    renderAppLayout();

    // When no repo is selected, show prompt to select one
    expect(
      screen.getByText("Select a repository to view commits")
    ).toBeInTheDocument();
  });

  it("renders all resizable panels", () => {
    renderAppLayout();

    // With our mock, panels have data-testid="panel-{id}"
    expect(screen.getByTestId("panel-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("panel-right-content")).toBeInTheDocument();
    expect(screen.getByTestId("panel-file-list")).toBeInTheDocument();
    expect(screen.getByTestId("panel-diff-view")).toBeInTheDocument();
  });

  it("renders separator handles between panels", () => {
    renderAppLayout();

    // With our mock, separators have data-testid="panel-separator"
    // In history mode: 1 outer (sidebar|right-content) + 1 inner (file-list|diff-view)
    const separators = screen.getAllByTestId("panel-separator");
    expect(separators.length).toBe(2);
  });

  it("keeps the file list panel visible when uncommitted changes are selected", () => {
    useAppStore.setState({ viewMode: "changes" });
    renderAppLayout();

    const separators = screen.getAllByTestId("panel-separator");
    expect(separators.length).toBe(2);
    expect(screen.getByTestId("panel-file-list")).toBeInTheDocument();
  });

  it("advances to the next panel on consecutive ArrowRight presses", () => {
    useAppStore.setState({ focusedRegion: null, viewMode: "history" });
    renderAppLayout();

    act(() => {
      pressKey("ArrowRight");
      pressKey("ArrowRight");
    });

    expect(useAppStore.getState().focusedRegion).toBe("files");
  });

  it("skips commit list when panel is collapsed during panel navigation", () => {
    useAppStore.setState({ focusedRegion: null, viewMode: "history" });
    renderAppLayout();

    act(() => {
      screen.getByRole("button", { name: /hide commit list/i }).click();
    });

    act(() => {
      pressKey("ArrowRight");
    });
    expect(useAppStore.getState().focusedRegion).toBe("files");

    act(() => {
      pressKey("ArrowRight");
    });
    expect(useAppStore.getState().focusedRegion).toBe("diff");

    act(() => {
      pressKey("ArrowRight");
    });
    expect(useAppStore.getState().focusedRegion).toBe("files");
  });

  it("moves focus away from commit list when panel is collapsed", () => {
    useAppStore.setState({ focusedRegion: "sidebar", viewMode: "history" });
    renderAppLayout();

    act(() => {
      screen.getByRole("button", { name: /hide commit list/i }).click();
    });

    expect(useAppStore.getState().focusedRegion).toBe("files");
  });

  it("skips file list in panel navigation when file list is hidden", () => {
    useAppStore.setState({
      commits: [
        {
          id: "commit-a",
          message: "A",
          author: "Ada",
          email: "ada@example.com",
          timestamp: 1,
          is_pushed: true,
        },
        {
          id: "commit-b",
          message: "B",
          author: "Ada",
          email: "ada@example.com",
          timestamp: 2,
          is_pushed: true,
        },
        {
          id: "commit-c",
          message: "C",
          author: "Ada",
          email: "ada@example.com",
          timestamp: 3,
          is_pushed: true,
        },
      ],
      selectedCommitIds: ["commit-a", "commit-c"],
      focusedRegion: null,
      viewMode: "history",
      isLoadingCommits: false,
      commitsError: null,
    });

    renderAppLayout();

    expect(screen.queryByTestId("panel-file-list")).not.toBeInTheDocument();

    act(() => {
      pressKey("ArrowRight");
    });
    expect(useAppStore.getState().focusedRegion).toBe("sidebar");

    act(() => {
      pressKey("ArrowRight");
    });
    expect(useAppStore.getState().focusedRegion).toBe("diff");
  });

  it("moves focus away from file list when file list becomes hidden", () => {
    useAppStore.setState({
      commits: [
        {
          id: "commit-a",
          message: "A",
          author: "Ada",
          email: "ada@example.com",
          timestamp: 1,
          is_pushed: true,
        },
        {
          id: "commit-b",
          message: "B",
          author: "Ada",
          email: "ada@example.com",
          timestamp: 2,
          is_pushed: true,
        },
        {
          id: "commit-c",
          message: "C",
          author: "Ada",
          email: "ada@example.com",
          timestamp: 3,
          is_pushed: true,
        },
      ],
      selectedCommitIds: ["commit-a"],
      focusedRegion: "files",
      viewMode: "history",
      isLoadingCommits: false,
      commitsError: null,
    });

    renderAppLayout();

    act(() => {
      useAppStore.getState().selectCommitRange(["commit-a", "commit-c"]);
    });

    expect(screen.queryByTestId("panel-file-list")).not.toBeInTheDocument();
    expect(useAppStore.getState().focusedRegion).toBe("sidebar");
  });

  it("restricts panel navigation to diff when diff view is maximized", () => {
    useAppStore.setState({ focusedRegion: "diff", viewMode: "history" });
    renderAppLayout();

    act(() => {
      screen.getByRole("button", { name: "Maximize diff view" }).click();
    });

    expect(useAppStore.getState().isDiffMaximized).toBe(true);
    expect(useAppStore.getState().focusedRegion).toBe("diff");

    act(() => {
      pressKey("ArrowRight");
    });
    expect(useAppStore.getState().focusedRegion).toBe("diff");

    act(() => {
      pressKey("ArrowLeft");
    });
    expect(useAppStore.getState().focusedRegion).toBe("diff");
  });

  it("collapses and restores side panels when diff view is maximized", () => {
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");
    const fileListPanel = screen.getByTestId("panel-file-list");

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
    expect(fileListPanel).toHaveAttribute("data-collapsed", "false");

    act(() => {
      screen.getByRole("button", { name: "Maximize diff view" }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");
    expect(fileListPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      screen.getByRole("button", { name: "Restore panel layout" }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
    expect(fileListPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("toggles diff maximize via keyboard shortcut", () => {
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");

    act(() => {
      pressKey("Enter", { ctrlKey: true });
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      pressKey("Enter", { ctrlKey: true });
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("toggles diff maximize via ] keyboard shortcut", () => {
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");

    act(() => {
      pressKey("]");
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      pressKey("]");
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("toggles commit list from toolbar button", () => {
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");

    act(() => {
      screen.getByRole("button", { name: /hide commit list/i }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      screen.getByRole("button", { name: /show commit list/i }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("toggles commit list via Mod+[ keyboard shortcut", () => {
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");

    act(() => {
      pressKey("[", { ctrlKey: true });
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      pressKey("[", { ctrlKey: true });
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("does not toggle commit list when diff view is maximized", () => {
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");

    act(() => {
      screen.getByRole("button", { name: "Maximize diff view" }).click();
    });

    expect(useAppStore.getState().isDiffMaximized).toBe(true);
    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");

    const toggleButton = screen.getByRole("button", {
      name: /commit list/i,
    });
    expect(toggleButton).toBeDisabled();

    act(() => {
      pressKey("[", { ctrlKey: true });
    });

    expect(useAppStore.getState().isDiffMaximized).toBe(true);
    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");
  });

  it("restores previous panel sizes after maximize toggle", () => {
    // Outer layout: sidebar width is stored under "main-layout"
    localStorage.setItem(
      "mock-panel-layout:main-layout",
      JSON.stringify({ sidebar: 33, "right-content": 67 })
    );
    // Inner layout: file-list/diff split stored under "content-layout"
    localStorage.setItem(
      "mock-panel-layout:content-layout",
      JSON.stringify({ "file-list": 17, "diff-view": 83 })
    );

    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");
    const fileListPanel = screen.getByTestId("panel-file-list");

    expect(sidebarPanel).toHaveAttribute("data-size", "33");
    expect(fileListPanel).toHaveAttribute("data-size", "17");

    act(() => {
      screen.getByRole("button", { name: "Maximize diff view" }).click();
    });

    act(() => {
      screen.getByRole("button", { name: "Restore panel layout" }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-size", "33");
    expect(fileListPanel).toHaveAttribute("data-size", "17");
  });

  it("preserves sidebar width when switching from History to Changes mode", () => {
    localStorage.setItem(
      "mock-panel-layout:main-layout",
      JSON.stringify({ sidebar: 33, "right-content": 67 })
    );

    useAppStore.setState({ viewMode: "history" });
    renderAppLayout();

    expect(screen.getByTestId("panel-sidebar")).toHaveAttribute(
      "data-size",
      "33"
    );

    act(() => {
      useAppStore.getState().setViewMode("changes");
    });

    // Sidebar is in the outer group which never restructures — width is preserved
    expect(screen.getByTestId("panel-sidebar")).toHaveAttribute(
      "data-size",
      "33"
    );
  });

  it("preserves sidebar width when switching from Changes to History mode", () => {
    localStorage.setItem(
      "mock-panel-layout:main-layout",
      JSON.stringify({ sidebar: 33, "right-content": 67 })
    );

    useAppStore.setState({ viewMode: "changes" });
    renderAppLayout();

    expect(screen.getByTestId("panel-sidebar")).toHaveAttribute(
      "data-size",
      "33"
    );

    act(() => {
      useAppStore.getState().setViewMode("history");
    });

    expect(screen.getByTestId("panel-sidebar")).toHaveAttribute(
      "data-size",
      "33"
    );
  });

  it("applies custom className", () => {
    const { container } = renderAppLayout({ className: "test-class" });

    // Find the layout div with the test-class (may be nested under provider wrappers)
    const layout = container.querySelector(".test-class");
    expect(layout).toBeInTheDocument();
  });

  it("suppresses panel navigation when overlay is open", () => {
    useAppStore.setState({
      focusedRegion: "sidebar",
      viewMode: "history",
      overlayOpen: true,
    });
    renderAppLayout();

    act(() => {
      pressKey("ArrowRight");
    });

    expect(useAppStore.getState().focusedRegion).toBe("sidebar");
  });

  it("suppresses layout shortcuts when overlay is open", () => {
    useAppStore.setState({
      viewMode: "history",
      overlayOpen: true,
    });
    renderAppLayout();

    const sidebarPanel = screen.getByTestId("panel-sidebar");
    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");

    act(() => {
      pressKey("]");
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
  });
});
