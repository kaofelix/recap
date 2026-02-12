import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandEmitter } from "../commands";
import { FocusProvider } from "../context/FocusContext";
import { useAppStore } from "../store/appStore";
import { useCommand } from "./useCommand";

// Test component that tracks command calls
function CommandListener({
  commandId,
  onCommand,
}: {
  commandId: string;
  onCommand: () => void;
}) {
  useCommand(commandId, onCommand);
  return <div data-testid="listener">Listening</div>;
}

describe("useCommand", () => {
  beforeEach(() => {
    useAppStore.setState({ focusedRegion: null });
  });

  afterEach(() => {
    useAppStore.setState({ focusedRegion: null });
    vi.clearAllMocks();
  });

  it("calls handler when command is emitted and region is focused", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: "sidebar" });

    render(
      <FocusProvider region="sidebar">
        <CommandListener commandId="test.command" onCommand={handler} />
      </FocusProvider>
    );

    commandEmitter.emit("test.command");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler when different region is focused", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: "files" });

    render(
      <FocusProvider region="sidebar">
        <CommandListener commandId="test.command" onCommand={handler} />
      </FocusProvider>
    );

    commandEmitter.emit("test.command");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler when no region is focused", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: null });

    render(
      <FocusProvider region="sidebar">
        <CommandListener commandId="test.command" onCommand={handler} />
      </FocusProvider>
    );

    commandEmitter.emit("test.command");

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes when component unmounts", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: "sidebar" });

    const { unmount } = render(
      <FocusProvider region="sidebar">
        <CommandListener commandId="test.command" onCommand={handler} />
      </FocusProvider>
    );

    unmount();
    commandEmitter.emit("test.command");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler for different command", () => {
    const handler = vi.fn();
    useAppStore.setState({ focusedRegion: "sidebar" });

    render(
      <FocusProvider region="sidebar">
        <CommandListener commandId="test.command" onCommand={handler} />
      </FocusProvider>
    );

    commandEmitter.emit("other.command");

    expect(handler).not.toHaveBeenCalled();
  });
});
