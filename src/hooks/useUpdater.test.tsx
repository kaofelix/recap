import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdater } from "./useUpdater";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  relaunch: vi.fn(),
  listen: vi.fn(),
  unlisten: vi.fn(),
}));

let menuHandler: (() => void) | null = null;

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: mocks.check,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mocks.relaunch,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

function TestComponent() {
  useUpdater();
  return null;
}

describe("useUpdater", () => {
  beforeEach(() => {
    mocks.check.mockReset();
    mocks.relaunch.mockReset();
    mocks.listen.mockReset();
    mocks.unlisten.mockReset();
    menuHandler = null;

    mocks.check.mockResolvedValue(null);
    mocks.listen.mockImplementation(
      (_eventName: string, handler: () => void) => {
        menuHandler = handler;
        return Promise.resolve(mocks.unlisten);
      }
    );
  });

  it("checks for updates when the Check for Updates menu item is selected", async () => {
    render(<TestComponent />);

    await waitFor(() => {
      expect(mocks.listen).toHaveBeenCalledWith(
        "menu://check-for-updates",
        expect.any(Function)
      );
    });

    await act(async () => {
      menuHandler?.();
    });

    await waitFor(() => {
      expect(mocks.check).toHaveBeenCalledTimes(1);
    });
  });
});
