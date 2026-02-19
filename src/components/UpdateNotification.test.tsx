import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../test/utils";
import { UpdateNotification } from "./UpdateNotification";

const useUpdaterMock = vi.fn();

vi.mock("../hooks/useUpdater", () => ({
  useUpdater: () => useUpdaterMock(),
}));

describe("UpdateNotification", () => {
  beforeEach(() => {
    useUpdaterMock.mockReset();
  });

  it("dismisses updater errors when close button is clicked", async () => {
    const dismissError = vi.fn();

    useUpdaterMock.mockReturnValue({
      checking: false,
      updateAvailable: null,
      downloading: false,
      error: "Failed to check for updates",
      downloadAndInstall: vi.fn(),
      dismissUpdate: vi.fn(),
      dismissError,
    });

    const user = userEvent.setup();

    render(<UpdateNotification />);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(dismissError).toHaveBeenCalledTimes(1);
  });

  it("dismisses available update notification", async () => {
    const dismissUpdate = vi.fn();

    useUpdaterMock.mockReturnValue({
      checking: false,
      updateAvailable: { version: "0.2.3" } as any,
      downloading: false,
      error: null,
      downloadAndInstall: vi.fn(),
      dismissUpdate,
      dismissError: vi.fn(),
    });

    const user = userEvent.setup();

    render(<UpdateNotification />);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(dismissUpdate).toHaveBeenCalledTimes(1);
  });
});
