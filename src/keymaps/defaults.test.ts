import { describe, expect, it } from "vitest";
import { defaultKeymap } from "./defaults";

describe("defaultKeymap", () => {
  it("includes keyboard shortcut to toggle diff display mode with |", () => {
    expect(defaultKeymap).toEqual(
      expect.arrayContaining([
        { key: "shift+|", command: "layout.toggleDiffDisplayMode" },
      ])
    );
  });
});
