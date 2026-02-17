import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandEmitter } from "../commands";
import { useAppStore } from "../store/appStore";
import { useGlobalCommand } from "./useGlobalCommand";

// Test component that tracks command calls
function GlobalCommandListener({
  commandId,
  onCommand,
}: {
  commandId: string;
  onCommand: () => void;
}) {
  useGlobalCommand(commandId, onCommand);
  return <div data-testid="listener">Listening</div>;
}

describe("useGlobalCommand", () => {
  beforeEach(() => {
    useAppStore.setState({ focusedRegion: null });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({ focusedRegion: null });
    });
    vi.clearAllMocks();
  });

  it("calls handler when command is emitted regardless of focus", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: null });

    render(
      <GlobalCommandListener commandId="test.command" onCommand={handler} />
    );

    commandEmitter.emit("test.command");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls handler even when a region is focused", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: "sidebar" });

    render(
      <GlobalCommandListener commandId="test.command" onCommand={handler} />
    );

    commandEmitter.emit("test.command");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when component unmounts", () => {
    const handler = vi.fn();

    const { unmount } = render(
      <GlobalCommandListener commandId="test.command" onCommand={handler} />
    );

    unmount();
    commandEmitter.emit("test.command");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler for different command", () => {
    const handler = vi.fn();

    render(
      <GlobalCommandListener commandId="test.command" onCommand={handler} />
    );

    commandEmitter.emit("other.command");

    expect(handler).not.toHaveBeenCalled();
  });
});
