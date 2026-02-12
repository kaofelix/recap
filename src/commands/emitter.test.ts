import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommandEmitter } from "./emitter";

describe("CommandEmitter", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls subscribed handler when command is emitted", () => {
    const emitter = createCommandEmitter();
    const handler = vi.fn();

    emitter.subscribe("test.command", handler);
    emitter.emit("test.command");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler for different command", () => {
    const emitter = createCommandEmitter();
    const handler = vi.fn();

    emitter.subscribe("test.command", handler);
    emitter.emit("other.command");

    expect(handler).not.toHaveBeenCalled();
  });

  it("calls multiple handlers for same command", () => {
    const emitter = createCommandEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    emitter.subscribe("test.command", handler1);
    emitter.subscribe("test.command", handler2);
    emitter.emit("test.command");

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("returns unsubscribe function", () => {
    const emitter = createCommandEmitter();
    const handler = vi.fn();

    const unsubscribe = emitter.subscribe("test.command", handler);
    unsubscribe();
    emitter.emit("test.command");

    expect(handler).not.toHaveBeenCalled();
  });

  it("only unsubscribes the specific handler", () => {
    const emitter = createCommandEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsubscribe1 = emitter.subscribe("test.command", handler1);
    emitter.subscribe("test.command", handler2);

    unsubscribe1();
    emitter.emit("test.command");

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("handles emit when no subscribers exist", () => {
    const emitter = createCommandEmitter();

    // Should not throw
    expect(() => emitter.emit("nonexistent.command")).not.toThrow();
  });
});
