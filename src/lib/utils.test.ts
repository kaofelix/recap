import { describe, expect, it } from "vitest";
import { splitPath } from "./utils";

describe("splitPath", () => {
  it("splits path into directory and filename", () => {
    expect(splitPath("src/components/Button.tsx")).toEqual({
      dir: "src/components/",
      filename: "Button.tsx",
    });
  });

  it("handles file without directory", () => {
    expect(splitPath("README.md")).toEqual({
      dir: "",
      filename: "README.md",
    });
  });

  it("handles deeply nested paths", () => {
    expect(splitPath("a/b/c/d/file.ts")).toEqual({
      dir: "a/b/c/d/",
      filename: "file.ts",
    });
  });
});
