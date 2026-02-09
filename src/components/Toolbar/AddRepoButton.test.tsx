import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../store/appStore";
import { tauriMocks } from "../../test/setup";
import { render, screen, waitFor } from "../../test/utils";
import { AddRepoButton } from "./AddRepoButton";

// Regex pattern for button name matching
const ADD_REPO_BUTTON = /add repo/i;

describe("AddRepoButton", () => {
  beforeEach(() => {
    // Reset store state
    act(() => {
      useAppStore.getState().clearRepos();
    });
    // Reset mocks
    vi.clearAllMocks();
  });

  it("should render the button", () => {
    render(<AddRepoButton />);

    expect(
      screen.getByRole("button", { name: ADD_REPO_BUTTON })
    ).toBeInTheDocument();
  });

  it("should have correct aria-label", () => {
    render(<AddRepoButton />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Add repository"
    );
  });

  it("should open folder picker when clicked", async () => {
    tauriMocks.dialogOpen.mockResolvedValue(null); // User cancels

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    expect(tauriMocks.dialogOpen).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Select Git Repository",
    });
  });

  it("should do nothing when user cancels folder picker", async () => {
    tauriMocks.dialogOpen.mockResolvedValue(null);

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    expect(tauriMocks.invoke).not.toHaveBeenCalled();
    expect(useAppStore.getState().repos).toHaveLength(0);
  });

  it("should validate repo and add to store on valid selection", async () => {
    const mockPath = "/path/to/my-repo";
    const mockRepoInfo = {
      path: mockPath,
      name: "my-repo",
      branch: "main",
    };

    tauriMocks.dialogOpen.mockResolvedValue(mockPath);
    tauriMocks.invoke.mockResolvedValue(mockRepoInfo);

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith("validate_repo", {
        path: mockPath,
      });
    });

    const repos = useAppStore.getState().repos;
    expect(repos).toHaveLength(1);
    expect(repos[0].path).toBe(mockPath);
  });

  it("should select the newly added repo", async () => {
    const mockPath = "/path/to/my-repo";
    const mockRepoInfo = {
      path: mockPath,
      name: "my-repo",
      branch: "main",
    };

    tauriMocks.dialogOpen.mockResolvedValue(mockPath);
    tauriMocks.invoke.mockResolvedValue(mockRepoInfo);

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.selectedRepoId).not.toBeNull();
      expect(state.repos.find((r) => r.id === state.selectedRepoId)?.path).toBe(
        mockPath
      );
    });
  });

  it("should call onError when validation fails", async () => {
    const mockPath = "/path/to/invalid-folder";
    const errorMessage = "Not a valid git repository";

    tauriMocks.dialogOpen.mockResolvedValue(mockPath);
    tauriMocks.invoke.mockRejectedValue(new Error(errorMessage));

    const onError = vi.fn();
    render(<AddRepoButton onError={onError} />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(errorMessage);
    });

    expect(useAppStore.getState().repos).toHaveLength(0);
  });

  it("should call onError with string errors", async () => {
    const mockPath = "/path/to/invalid-folder";
    const errorMessage = "String error message";

    tauriMocks.dialogOpen.mockResolvedValue(mockPath);
    tauriMocks.invoke.mockRejectedValue(errorMessage);

    const onError = vi.fn();
    render(<AddRepoButton onError={onError} />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(errorMessage);
    });
  });

  it("should show loading state while processing", async () => {
    let resolveDialog: (value: string | null) => void;
    const dialogPromise = new Promise<string | null>((resolve) => {
      resolveDialog = resolve;
    });

    tauriMocks.dialogOpen.mockReturnValue(dialogPromise);

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });

    // Click and check loading state
    act(() => {
      button.click();
    });

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("Adding...");
      expect(screen.getByRole("button")).toBeDisabled();
    });

    // Resolve and check it goes back to normal
    await act(async () => {
      resolveDialog?.(null);
    });

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("Add Repo");
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  it("should handle array response from dialog", async () => {
    const mockPath = "/path/to/my-repo";
    const mockRepoInfo = {
      path: mockPath,
      name: "my-repo",
      branch: "main",
    };

    // Dialog can return array
    tauriMocks.dialogOpen.mockResolvedValue([mockPath]);
    tauriMocks.invoke.mockResolvedValue(mockRepoInfo);

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith("validate_repo", {
        path: mockPath,
      });
    });
  });

  it("should apply custom className", () => {
    render(<AddRepoButton className="custom-class" />);

    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("should not add duplicate repos", async () => {
    const mockPath = "/path/to/my-repo";
    const mockRepoInfo = {
      path: mockPath,
      name: "my-repo",
      branch: "main",
    };

    tauriMocks.dialogOpen.mockResolvedValue(mockPath);
    tauriMocks.invoke.mockResolvedValue(mockRepoInfo);

    render(<AddRepoButton />);

    const button = screen.getByRole("button", { name: ADD_REPO_BUTTON });

    // Click twice
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(useAppStore.getState().repos).toHaveLength(1);
    });

    await act(async () => {
      button.click();
    });

    // Should still only have one repo (store handles duplicates)
    await waitFor(() => {
      expect(useAppStore.getState().repos).toHaveLength(1);
    });
  });
});
