import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandEmitter } from "../commands";
import type { KeyBinding } from "../keymaps/types";
import { useKeyboardHandler } from "./useKeyboardHandler";

// Test component that sets up keyboard handler
function KeyboardHandlerTest({ keymap }: { keymap: KeyBinding[] }) {
  useKeyboardHandler(keymap);
  return <div data-testid="handler">Handler active</div>;
}

describe("useKeyboardHandler", () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    emitSpy = vi.spyOn(commandEmitter, "emit");
  });

  afterEach(async () => {
    await act(async () => {
      vi.restoreAllMocks();
    });
  });

  it("emits command when matching key is pressed", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    render(<KeyboardHandlerTest keymap={keymap} />);

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(emitSpy).toHaveBeenCalledWith("navigation.selectNext");
  });

  it("prevents default browser behavior when matching key is pressed", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    render(<KeyboardHandlerTest keymap={keymap} />);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
  });

  it("emits command for key with modifier", () => {
    const keymap: KeyBinding[] = [
      { key: "ctrl+n", command: "navigation.selectNext" },
    ];

    render(<KeyboardHandlerTest keymap={keymap} />);

    fireEvent.keyDown(document, { key: "n", ctrlKey: true });

    expect(emitSpy).toHaveBeenCalledWith("navigation.selectNext");
  });

  it("does not emit for non-matching key", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    render(<KeyboardHandlerTest keymap={keymap} />);

    fireEvent.keyDown(document, { key: "ArrowUp" });

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("does not prevent default for non-matching keys", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    render(<KeyboardHandlerTest keymap={keymap} />);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    document.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("handles multiple keybindings", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
      { key: "ArrowUp", command: "navigation.selectPrev" },
    ];

    render(<KeyboardHandlerTest keymap={keymap} />);

    fireEvent.keyDown(document, { key: "ArrowUp" });

    expect(emitSpy).toHaveBeenCalledWith("navigation.selectPrev");
  });

  it("removes event listener on unmount", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    const { unmount } = render(<KeyboardHandlerTest keymap={keymap} />);
    unmount();

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("does not emit when focused on input element", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    render(
      <>
        <KeyboardHandlerTest keymap={keymap} />
        <input data-testid="input" type="text" />
      </>
    );

    const input = document.querySelector("input");
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error("Expected input to exist");
    }
    input.focus();

    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("does not emit when focused on textarea element", () => {
    const keymap: KeyBinding[] = [
      { key: "ArrowDown", command: "navigation.selectNext" },
    ];

    render(
      <>
        <KeyboardHandlerTest keymap={keymap} />
        <textarea data-testid="textarea" />
      </>
    );

    const textarea = document.querySelector("textarea");
    expect(textarea).not.toBeNull();
    if (!textarea) {
      throw new Error("Expected textarea to exist");
    }
    textarea.focus();

    fireEvent.keyDown(textarea, { key: "ArrowDown" });

    expect(emitSpy).not.toHaveBeenCalled();
  });
});
