import { describe, expect, it } from "vitest";
import { eventToKeyString } from "./parser";

/**
 * Creates a minimal KeyboardEvent-like object for testing
 */
function createKeyEvent(
  key: string,
  options: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  } = {}
): KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrl ?? false,
    shiftKey: options.shift ?? false,
    altKey: options.alt ?? false,
    metaKey: options.meta ?? false,
  } as KeyboardEvent;
}

describe("eventToKeyString", () => {
  it("returns simple key for plain keypress", () => {
    const event = createKeyEvent("a");
    expect(eventToKeyString(event)).toBe("a");
  });

  it("returns arrow key names", () => {
    expect(eventToKeyString(createKeyEvent("ArrowDown"))).toBe("ArrowDown");
    expect(eventToKeyString(createKeyEvent("ArrowUp"))).toBe("ArrowUp");
    expect(eventToKeyString(createKeyEvent("ArrowLeft"))).toBe("ArrowLeft");
    expect(eventToKeyString(createKeyEvent("ArrowRight"))).toBe("ArrowRight");
  });

  it("includes ctrl modifier", () => {
    const event = createKeyEvent("n", { ctrl: true });
    expect(eventToKeyString(event)).toBe("ctrl+n");
  });

  it("includes shift modifier", () => {
    const event = createKeyEvent("ArrowUp", { shift: true });
    expect(eventToKeyString(event)).toBe("shift+ArrowUp");
  });

  it("includes alt modifier", () => {
    const event = createKeyEvent("a", { alt: true });
    expect(eventToKeyString(event)).toBe("alt+a");
  });

  it("includes meta modifier", () => {
    const event = createKeyEvent("k", { meta: true });
    expect(eventToKeyString(event)).toBe("meta+k");
  });

  it("combines multiple modifiers in consistent order", () => {
    const event = createKeyEvent("a", {
      ctrl: true,
      shift: true,
      alt: true,
      meta: true,
    });
    expect(eventToKeyString(event)).toBe("ctrl+shift+alt+meta+a");
  });

  it("handles Enter key", () => {
    expect(eventToKeyString(createKeyEvent("Enter"))).toBe("Enter");
  });

  it("handles Escape key", () => {
    expect(eventToKeyString(createKeyEvent("Escape"))).toBe("Escape");
  });
});
