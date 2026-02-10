import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../store/appStore";
import { tauriMocks } from "../../test/setup";
import { render, screen, userEvent } from "../../test/utils";
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

    expect(useAppStore.getState().selectedCommitId).toBe("some-commit-id");

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    await waitFor(() => {
      expect(useAppStore.getState().selectedCommitId).toBeNull();
    });
  });

  it("should show error when checkout fails", async () => {
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

    render(<BranchPickerButton />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /select branch/i });
    await user.click(button);

    const featureAItem = screen.getByRole("menuitem", { name: /feature-a/i });
    await user.click(featureAItem);

    // Dropdown closes after click, re-open to see error
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/uncommitted changes/i)).toBeInTheDocument();
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
});
