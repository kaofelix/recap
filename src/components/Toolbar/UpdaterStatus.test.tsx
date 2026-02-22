import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../../test/utils";
import { UpdaterStatus } from "./UpdaterStatus";

const useUpdaterMock = vi.fn();

vi.mock("../../hooks/useUpdater", () => ({
  useUpdater: () => useUpdaterMock(),
}));

describe("UpdaterStatus", () => {
  beforeEach(() => {
    useUpdaterMock.mockReset();
  });

  it("shows checking state message", () => {
    useUpdaterMock.mockReturnValue({
      checking: true,
      updateAvailable: null,
      downloading: false,
      error: null,
      checkForUpdates: vi.fn(),
      downloadAndInstall: vi.fn(),
      dismissUpdate: vi.fn(),
      dismissError: vi.fn(),
    });

    render(<UpdaterStatus />);

    expect(screen.getByText("Checking for updates…")).toBeInTheDocument();
  });

  it("shows update action as an underlined link-style control", async () => {
    const downloadAndInstall = vi.fn();

    useUpdaterMock.mockReturnValue({
      checking: false,
      updateAvailable: { version: "0.2.4" } as any,
      downloading: false,
      error: null,
      checkForUpdates: vi.fn(),
      downloadAndInstall,
      dismissUpdate: vi.fn(),
      dismissError: vi.fn(),
    });

    const user = userEvent.setup();

    render(<UpdaterStatus />);

    const action = screen.getByRole("button", { name: "Update and restart" });
    expect(action).toHaveClass("underline");

    await user.click(action);

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
  });
});
