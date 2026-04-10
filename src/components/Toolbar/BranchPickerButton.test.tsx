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
      checked_out_worktree_path: "/path/to/my-repo",
    },
    {
      name: "feature-a",
      is_current: false,
      is_remote: false,
      commit_id: "def4567890123",
      checked_out_worktree_path: null,
    },
    {
      name: "feature-b",
      is_current: false,
      is_remote: false,
      commit_id: "ghi7890123456",
      checked_out_worktree_path: "/path/to/my-repo-feature",
    },
    {
      name: "origin/main",
      is_current: false,
      is_remote: true,
      commit_id: "abc1234567890",
      checked_out_worktree_path: null,
    },
  ];
}

function createMockWorktrees() {
  return [
    {
      name: "main-worktree",
      path: "/path/to/my-repo",
      branch: "main",
      is_main: true,
    },
    {
      name: "feature-worktree",
      path: "/path/to/my-repo-feature",
      branch: "feature-b",
      is_main: false,
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

    // Default mock implementation for branch/worktree commands
    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve(createMockBranches());
      }
      if (cmd === "list_worktrees") {
        return Promise.resolve(createMockWorktrees());
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

  it("should display the current branch for the primary worktree and show its full path in a tooltip", async () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    expect(screen.queryByText("main-worktree")).not.toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("/path/to/my-repo");
  });

  it("treats the selected repo as the primary context when its canonical path matches the main worktree", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve([
          {
            name: "main",
            is_current: true,
            is_remote: false,
            commit_id: "abc1234567890",
            checked_out_worktree_path: "/path/to/actual-repo",
          },
        ]);
      }
      if (cmd === "list_worktrees") {
        return Promise.resolve([
          {
            name: "actual-repo",
            path: "/path/to/actual-repo",
            branch: "main",
            is_main: true,
          },
        ]);
      }
      if (cmd === "checkout_branch") {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo({
        path: "/path/to/alias-repo",
        canonicalPath: "/path/to/actual-repo",
        name: "actual-repo",
      });
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /select branch/i })
      ).toHaveTextContent("main");
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const branchItem = screen.getByRole("menuitem", { name: /^main$/i });
    // eslint-disable-next-line testing-library/no-node-access
    expect(branchItem.querySelector("svg")).toBeInTheDocument();
  });

  it("treats a repo with no linked worktrees as the primary context even when the selected path differs", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve([
          {
            name: "main",
            is_current: true,
            is_remote: false,
            commit_id: "abc1234567890",
            checked_out_worktree_path: "/path/to/actual-repo",
          },
        ]);
      }
      if (cmd === "list_worktrees") {
        return Promise.resolve([
          {
            name: "actual-repo",
            path: "/path/to/actual-repo",
            branch: "main",
            is_main: true,
          },
        ]);
      }
      if (cmd === "checkout_branch") {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo({
        path: "/path/to/alias-repo",
        canonicalPath: "/path/to/alias-repo",
        name: "alias-repo",
      });
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /select branch/i });
      expect(button).toHaveTextContent("main");
      // eslint-disable-next-line testing-library/no-node-access
      expect(button.querySelector(".lucide-git-branch")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const branchItem = screen.getByRole("menuitem", { name: /^main$/i });
    // eslint-disable-next-line testing-library/no-node-access
    expect(branchItem.querySelector("svg")).toBeInTheDocument();
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

  it("should show primary-worktree branches under Branches and only linked worktrees under Worktrees", async () => {
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

    expect(screen.getByText("Worktrees")).toBeInTheDocument();
    expect(screen.getByText("Branches")).toBeInTheDocument();

    expect(
      screen.getByRole("menuitem", { name: /^main$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /feature-worktree/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /feature-a/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("menuitem", { name: /main-worktree/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /feature-b/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /origin\/main/i })
    ).not.toBeInTheDocument();
  });

  it("should show the checkmark on the current branch when viewing the primary worktree", async () => {
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

    const branchItem = screen.getByRole("menuitem", { name: /^main$/i });
    // eslint-disable-next-line testing-library/no-node-access
    const checkmark = branchItem.querySelector("svg");
    expect(checkmark).toBeInTheDocument();
  });

  it("should show the linked worktree name when viewing a linked worktree", async () => {
    tauriMocks.invoke.mockImplementation(
      (cmd: string, args?: { repoPath?: string }) => {
        if (cmd === "list_branches") {
          if (args?.repoPath === "/path/to/my-repo-feature") {
            return Promise.resolve([
              {
                name: "main",
                is_current: false,
                is_remote: false,
                commit_id: "abc1234567890",
                checked_out_worktree_path: "/path/to/my-repo",
              },
              {
                name: "feature-a",
                is_current: false,
                is_remote: false,
                commit_id: "def4567890123",
                checked_out_worktree_path: null,
              },
              {
                name: "feature-b",
                is_current: true,
                is_remote: false,
                commit_id: "ghi7890123456",
                checked_out_worktree_path: "/path/to/my-repo-feature",
              },
            ]);
          }
          return Promise.resolve(createMockBranches());
        }
        if (cmd === "list_worktrees") {
          return Promise.resolve(createMockWorktrees());
        }
        if (cmd === "checkout_branch") {
          return Promise.resolve();
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      }
    );

    act(() => {
      useAppStore.getState().addRepo({
        path: "/path/to/my-repo-feature",
        canonicalPath: "/path/to/my-repo",
        name: "my-repo",
      });
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("feature-worktree")).toBeInTheDocument();
    });

    expect(screen.queryByText(/^feature-b$/)).not.toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "/path/to/my-repo-feature"
    );
  });

  it("should show linked worktree paths in the worktrees section", async () => {
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

    expect(
      screen.getByRole("menuitem", {
        name: /feature-worktree.*\/path\/to\/my-repo-feature/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", {
        name: /main-worktree.*\/path\/to\/my-repo/i,
      })
    ).not.toBeInTheDocument();
  });

  it("should abbreviate home-directory paths in the tooltip and worktree rows", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve([
          {
            name: "main",
            is_current: true,
            is_remote: false,
            commit_id: "abc1234567890",
            checked_out_worktree_path: "/Users/kaofelix/Code/doto",
          },
        ]);
      }
      if (cmd === "list_worktrees") {
        return Promise.resolve([
          {
            name: "main-worktree",
            path: "/Users/kaofelix/Code/doto",
            branch: "main",
            is_main: true,
          },
          {
            name: "feat1",
            path: "/Users/kaofelix/Code/doto--feat1",
            branch: "feat1",
            is_main: false,
          },
        ]);
      }
      if (cmd === "checkout_branch") {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo("/Users/kaofelix/Code/doto");
    });

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("~/Code/doto");

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    expect(
      screen.getByRole("menuitem", { name: /feat1.*~\/Code\/doto--feat1/i })
    ).toBeInTheDocument();
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

  it("should switch active worktree when clicking a worktree item", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo({
        path: "/path/to/my-repo",
        canonicalPath: "/path/to/my-repo",
        name: "my-repo",
      });
      useAppStore.getState().selectCommit("some-commit-id");
    });

    const repoId = useAppStore.getState().selectedRepoId;
    expect(repoId).not.toBeNull();

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureWorktreeItem = screen.getByRole("menuitem", {
      name: /feature-worktree/i,
    });
    await user.click(featureWorktreeItem);

    await waitFor(() => {
      expect(useAppStore.getState().selectedRepoId).toBe(repoId);
      expect(useAppStore.getState().repos[0]?.path).toBe(
        "/path/to/my-repo-feature"
      );
    });

    expect(
      tauriMocks.invoke.mock.calls.some(([cmd]) => cmd === "checkout_branch")
    ).toBe(false);
    expect(useAppStore.getState().selectedCommitIds[0] ?? null).toBeNull();
  });

  it("should switch to the primary worktree instead of checking out its branch from a linked worktree", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation(
      (cmd: string, args?: { repoPath?: string }) => {
        if (cmd === "list_branches") {
          if (args?.repoPath === "/path/to/my-repo-feature") {
            return Promise.resolve([
              {
                name: "main",
                is_current: false,
                is_remote: false,
                commit_id: "abc1234567890",
                checked_out_worktree_path: "/path/to/my-repo",
              },
              {
                name: "feature-a",
                is_current: false,
                is_remote: false,
                commit_id: "def4567890123",
                checked_out_worktree_path: null,
              },
              {
                name: "feature-b",
                is_current: true,
                is_remote: false,
                commit_id: "ghi7890123456",
                checked_out_worktree_path: "/path/to/my-repo-feature",
              },
            ]);
          }
          return Promise.resolve(createMockBranches());
        }
        if (cmd === "list_worktrees") {
          return Promise.resolve(createMockWorktrees());
        }
        if (cmd === "checkout_branch") {
          return Promise.resolve();
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      }
    );

    act(() => {
      useAppStore.getState().addRepo({
        path: "/path/to/my-repo-feature",
        canonicalPath: "/path/to/my-repo",
        name: "my-repo",
      });
      useAppStore.getState().selectCommit("some-commit-id");
    });

    const repoId = useAppStore.getState().selectedRepoId;
    expect(repoId).not.toBeNull();

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("feature-worktree")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const mainItem = screen.getByRole("menuitem", { name: /^main$/i });
    await user.click(mainItem);

    await waitFor(() => {
      expect(useAppStore.getState().selectedRepoId).toBe(repoId);
      expect(useAppStore.getState().repos[0]?.path).toBe("/path/to/my-repo");
    });

    expect(
      tauriMocks.invoke.mock.calls.some(([cmd]) => cmd === "checkout_branch")
    ).toBe(false);
    expect(useAppStore.getState().selectedCommitIds[0] ?? null).toBeNull();
  });

  it("should switch to the primary worktree and then check out an unowned branch from a linked worktree", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation(
      (cmd: string, args?: { repoPath?: string }) => {
        if (cmd === "list_branches") {
          if (args?.repoPath === "/path/to/my-repo-feature") {
            return Promise.resolve([
              {
                name: "main",
                is_current: false,
                is_remote: false,
                commit_id: "abc1234567890",
                checked_out_worktree_path: "/path/to/my-repo",
              },
              {
                name: "feature-a",
                is_current: false,
                is_remote: false,
                commit_id: "def4567890123",
                checked_out_worktree_path: null,
              },
              {
                name: "feature-b",
                is_current: true,
                is_remote: false,
                commit_id: "ghi7890123456",
                checked_out_worktree_path: "/path/to/my-repo-feature",
              },
            ]);
          }
          return Promise.resolve(createMockBranches());
        }
        if (cmd === "list_worktrees") {
          return Promise.resolve(createMockWorktrees());
        }
        if (cmd === "checkout_branch") {
          return Promise.resolve();
        }
        return Promise.reject(new Error(`Unknown command: ${cmd}`));
      }
    );

    act(() => {
      useAppStore.getState().addRepo({
        path: "/path/to/my-repo-feature",
        canonicalPath: "/path/to/my-repo",
        name: "my-repo",
      });
      useAppStore.getState().selectCommit("some-commit-id");
    });

    const repoId = useAppStore.getState().selectedRepoId;
    expect(repoId).not.toBeNull();

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("feature-worktree")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    await waitFor(() => {
      expect(useAppStore.getState().selectedRepoId).toBe(repoId);
      expect(useAppStore.getState().repos[0]?.path).toBe("/path/to/my-repo");
      expect(tauriMocks.invoke).toHaveBeenCalledWith("checkout_branch", {
        repoPath: "/path/to/my-repo",
        branchName: "feature-a",
      });
    });

    expect(useAppStore.getState().selectedCommitIds[0] ?? null).toBeNull();
  });

  it("should show a toast when checkout fails", async () => {
    const user = userEvent.setup();

    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches") {
        return Promise.resolve(createMockBranches());
      }
      if (cmd === "list_worktrees") {
        return Promise.resolve(createMockWorktrees());
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
      if (cmd === "list_branches" || cmd === "list_worktrees") {
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

  it("should show the raw worktree directory name until worktree metadata loads", async () => {
    tauriMocks.invoke.mockImplementation((cmd: string) => {
      if (cmd === "list_branches" || cmd === "list_worktrees") {
        return new Promise(() => undefined);
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<BranchPickerButton />);

    expect(screen.getByText("my-repo")).toBeInTheDocument();
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
              checked_out_worktree_path: "/path/to/my-repo",
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
            checked_out_worktree_path: "/path/to/my-repo",
          },
          {
            name: "new-feature",
            is_current: false,
            is_remote: false,
            commit_id: "xyz9876543210",
            checked_out_worktree_path: null,
          },
        ]);
      }
      if (cmd === "list_worktrees") {
        return Promise.resolve(createMockWorktrees());
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

  it("blurs trigger button after dropdown closes to prevent arrow key reopening", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/repo");
    });

    render(<BranchPickerButton />);

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

    // Flush requestAnimationFrame used for deferred blur
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    // Trigger button should not retain focus after close
    expect(document.activeElement).not.toBe(button);
  });
});
