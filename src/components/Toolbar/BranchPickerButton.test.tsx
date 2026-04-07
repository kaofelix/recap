import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../store/appStore";
import { useToastStore } from "../../store/toastStore";
import { tauriMocks } from "../../test/setup";
import { render, screen, userEvent } from "../../test/utils";
import { Toaster } from "../Toaster";
import { BranchPickerButton } from "./BranchPickerButton";

function createMockBranches() {
  return [
    {
      name: "main",
      is_current: true,
      is_remote: false,
      commit_id: "abc1234567890",
    },
    {
      name: "feature-a",
      is_current: false,
      is_remote: false,
      commit_id: "def4567890123",
    },
    {
      name: "feature-b",
      is_current: false,
      is_remote: false,
      commit_id: "ghi7890123456",
    },
    {
      name: "origin/main",
      is_current: false,
      is_remote: true,
      commit_id: "abc1234567890",
    },
  ];
}

describe("BranchPickerButton", () => {
  beforeEach(() => {
    // Reset store state
    act(() => {
      useAppStore.getState().clearRepos();
      useToastStore.getState().clearToasts();
    });

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementation for list_branches
    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve(createMockBranches());
      }
      if (cmd === "checkout_branch") {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });
  });

  it("should not render when no repo is selected", () => {
    render(<BranchPickerButton />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should render when a repo is selected", async () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /select branch/i })
      ).toBeInTheDocument();
    });
  });

  it("should display the current branch name", async () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });
  });

  it("should fetch branches when repo changes", async () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith("list_branches", {
        repoPath: "/path/to/my-repo",
      });
    });
  });

  it("should open dropdown with branch list when clicked", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    // Should show local branches only (not remote)
    expect(screen.getByRole("menuitem", { name: /main/i })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /feature-a/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /feature-b/i })
    ).toBeInTheDocument();
    // Remote branches should not be shown
    expect(
      screen.queryByRole("menuitem", { name: /origin\/main/i })
    ).not.toBeInTheDocument();
  });

  it("should show checkmark on current branch", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const mainItem = screen.getByRole("menuitem", { name: /main/i });
    // eslint-disable-next-line testing-library/no-node-access
    const checkmark = mainItem.querySelector("svg");
    expect(checkmark).toBeInTheDocument();
  });

  it("should show commit hash for each branch", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    // Should show first 7 chars of commit hash
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("def4567")).toBeInTheDocument();
  });

  it("should switch branch when clicking a different one", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith("checkout_branch", {
        repoPath: "/path/to/my-repo",
        branchName: "feature-a",
      });
    });
  });

  it("should clear commit selection after switching branch", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
      useAppStore.getState().selectCommit("some-commit-id");
    });

    expect(useAppStore.getState().selectedCommitIds[0] ?? null).toBe(
      "some-commit-id"
    );

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    await waitFor(() => {
      expect(useAppStore.getState().selectedCommitIds[0] ?? null).toBeNull();
    });
  });

  it("should show a toast when checkout fails", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve(createMockBranches());
      }
      if (cmd === "checkout_branch") {
        return Promise.reject(
          new Error("Cannot switch branches: you have uncommitted changes")
        );
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(
      <>
        <BranchPickerButton />
        <Toaster />
      </>
    );

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /uncommitted changes/i
      );
    });
  });

  it("should show loading state while fetching branches", async () => {
    // Make list_branches hang
    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        // Never resolves - simulates hanging request
        return new Promise(() => undefined);
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    // Button should show "Select branch" and be disabled during loading
    const button = screen.getByRole("button", { name: /select branch/i });
    expect(button).toHaveClass("opacity-50");
  });

  it("should apply custom className", async () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton className="custom-class" />);

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveClass("custom-class");
    });
  });

  it("should close dropdown after selecting a branch", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    await waitFor(() => {
      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    });
  });

  it("should display branch name from store when available", async () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
      useAppStore.getState().setCurrentBranchName("develop");
    });

    // list_branches returns different current (simulate external branch change detected by polling)
    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve([
          {
            name: "develop",
            is_current: true,
            is_remote: false,
            commit_id: "aaa1111111111",
          },
        ]);
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    render(<BranchPickerButton />);

    // Should show store's currentBranchName immediately (before fetch completes)
    expect(screen.getByText("develop")).toBeInTheDocument();

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith("list_branches", {
        repoPath: "/path/to/my-repo",
      });
    });
  });

  it("should show store branch name even before branches are fetched", async () => {
    // Make list_branches hang forever
    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return new Promise(() => undefined);
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
      useAppStore.getState().setCurrentBranchName("my-feature");
    });

    render(<BranchPickerButton />);

    // Should show the store name even though list_branches hasn't resolved
    expect(screen.getByText("my-feature")).toBeInTheDocument();
  });

  it("should refresh branches when dropdown is opened", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const initialCallCount = tauriMocks.invoke.mock.calls.filter(
      ([cmd]) => cmd === "list_branches"
    ).length;

    // Open dropdown
    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    // Should have fetched branches again on open
    await waitFor(() => {
      const newCallCount = tauriMocks.invoke.mock.calls.filter(
        ([cmd]) => cmd === "list_branches"
      ).length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);
    });
  });

  it("should show newly created branch after opening dropdown", async () => {
    const user = userEvent.setup();
    let callCount = 0;

    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        callCount++;
        if (callCount === 1) {
          // Initial fetch — only main
          return Promise.resolve([
            {
              name: "main",
              is_current: true,
              is_remote: false,
              commit_id: "abc1234567890",
            },
          ]);
        }
        // Subsequent fetches — new branch appeared
        return Promise.resolve([
          {
            name: "main",
            is_current: true,
            is_remote: false,
            commit_id: "abc1234567890",
          },
          {
            name: "new-feature",
            is_current: false,
            is_remote: false,
            commit_id: "xyz9876543210",
          },
        ]);
      }
      if (cmd === "checkout_branch") {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    // Open dropdown — triggers a refresh
    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    // Should now show the new branch
    await waitFor(() => {
      expect(
        screen.getByRole("menuitem", { name: /new-feature/i })
      ).toBeInTheDocument();
    });
  });

  it("sets overlayOpen to true when dropdown opens and false when it closes", async () => {
    const user = userEvent.setup();

    // Need a selected repo for the button to render
    act(() => {
      useAppStore.getState().addRepo("/path/to/repo");
    });

    render(<BranchPickerButton />);

    expect(useAppStore.getState().overlayOpen).toBe(false);

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(true);
    });

    // Press Escape to close
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(false);
    });
  });
});
