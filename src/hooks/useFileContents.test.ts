import { invoke } from "@tauri-apps/api/core";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileContents } from "../types/diff";
import { useFileContents } from "./useFileContents";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe("useFileContents", () => {
  const mockRepo = { path: "/test/repo", name: "test-repo", branch: "main" };
  const mockFilePath = "src/file.ts";
  const mockCommitId = "abc123";

  const mockContents: FileContents = {
    old_content: "old content",
    new_content: "new content",
    is_binary: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial state when repo is null", () => {
    const { result } = renderHook(() =>
      useFileContents(null, mockFilePath, mockCommitId)
    );

    expect(result.current.contents).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("returns initial state when filePath is null", () => {
    const { result } = renderHook(() =>
      useFileContents(mockRepo, null, mockCommitId)
    );

    expect(result.current.contents).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("fetches from commit when commitId is provided", async () => {
    mockInvoke.mockResolvedValueOnce(mockContents);

    const { result } = renderHook(() =>
      useFileContents(mockRepo, mockFilePath, mockCommitId)
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_file_contents", {
      repoPath: mockRepo.path,
      commitId: mockCommitId,
      filePath: mockFilePath,
    });
    expect(result.current.contents).toEqual(mockContents);
    expect(result.current.error).toBeNull();
  });

  it("fetches from working directory when commitId is null", async () => {
    mockInvoke.mockResolvedValueOnce(mockContents);

    const { result } = renderHook(() =>
      useFileContents(mockRepo, mockFilePath, null)
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_working_file_contents", {
      repoPath: mockRepo.path,
      filePath: mockFilePath,
    });
    expect(result.current.contents).toEqual(mockContents);
    expect(result.current.error).toBeNull();
  });

  it("handles errors", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Failed to fetch"));

    const { result } = renderHook(() =>
      useFileContents(mockRepo, mockFilePath, mockCommitId)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.contents).toBeNull();
    expect(result.current.error).toBe("Failed to fetch");
  });

  it("refetches when filePath changes", async () => {
    mockInvoke.mockResolvedValue(mockContents);

    const { result, rerender } = renderHook(
      ({ filePath }) => useFileContents(mockRepo, filePath, mockCommitId),
      { initialProps: { filePath: "file1.ts" } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    rerender({ filePath: "file2.ts" });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    expect(mockInvoke).toHaveBeenLastCalledWith("get_file_contents", {
      repoPath: mockRepo.path,
      commitId: mockCommitId,
      filePath: "file2.ts",
    });
  });

  it("switches from commit to working directory when commitId changes to null", async () => {
    mockInvoke.mockResolvedValue(mockContents);

    const { result, rerender } = renderHook(
      ({ commitId }) => useFileContents(mockRepo, mockFilePath, commitId),
      { initialProps: { commitId: mockCommitId as string | null } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_file_contents", {
      repoPath: mockRepo.path,
      commitId: mockCommitId,
      filePath: mockFilePath,
    });

    rerender({ commitId: null });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    expect(mockInvoke).toHaveBeenLastCalledWith("get_working_file_contents", {
      repoPath: mockRepo.path,
      filePath: mockFilePath,
    });
  });

  it("clears contents when filePath becomes null", async () => {
    mockInvoke.mockResolvedValue(mockContents);

    const { result, rerender } = renderHook(
      ({ filePath }) => useFileContents(mockRepo, filePath, mockCommitId),
      { initialProps: { filePath: mockFilePath as string | null } }
    );

    await waitFor(() => {
      expect(result.current.contents).toEqual(mockContents);
    });

    rerender({ filePath: null });

    expect(result.current.contents).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
