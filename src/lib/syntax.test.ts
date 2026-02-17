import { describe, expect, it } from "vitest";
import { getLanguageFromPath, highlightCode } from "./syntax";

describe("getLanguageFromPath", () => {
  it.each([
    ["src/app.ts", "typescript"],
    ["src/app.tsx", "tsx"],
    ["src/app.js", "javascript"],
    ["src/app.jsx", "jsx"],
    ["src/main.rs", "rust"],
    ["script.py", "python"],
    ["styles.css", "css"],
    ["styles.scss", "scss"],
    ["index.html", "markup"],
    ["package.json", "json"],
    ["config.yml", "yaml"],
    ["config.yaml", "yaml"],
    ["README.md", "markdown"],
    ["lib/example.rb", "ruby"],
    ["Sources/App.swift", "swift"],
    ["src/main.c", "c"],
    ["src/main.cpp", "cpp"],
    ["src/ViewController.m", "objectivec"],
    ["src/ViewController.mm", "objectivec"],
    ["Dockerfile", "docker"],
    ["Makefile", "makefile"],
  ])("detects language for %s", (filePath, expectedLanguage) => {
    expect(getLanguageFromPath(filePath)).toBe(expectedLanguage);
  });

  it("returns null for unknown extensions", () => {
    expect(getLanguageFromPath("file.unknown")).toBeNull();
    expect(getLanguageFromPath("file")).toBeNull();
  });

  it("handles paths with multiple dots", () => {
    expect(getLanguageFromPath("file.test.ts")).toBe("typescript");
    expect(getLanguageFromPath("file.config.js")).toBe("javascript");
  });

  it("is case-insensitive for extensions", () => {
    expect(getLanguageFromPath("FILE.TS")).toBe("typescript");
    expect(getLanguageFromPath("file.JSON")).toBe("json");
  });
});

describe("highlightCode", () => {
  it.each([
    ["javascript", "const x = 1;", ["token", "keyword"]],
    ["typescript", "const x: number = 1;", ["token"]],
    ["rust", "fn main() {}", ["token", "keyword"]],
    ["ruby", "def greet(name)\n  puts name\nend", ["token", "keyword"]],
    [
      "swift",
      "func greet(name: String) -> String { name }",
      ["token", "keyword"],
    ],
    ["c", "int main(void) { return 0; }", ["token", "keyword"]],
    ["cpp", "int main() { return 0; }", ["token", "keyword"]],
    ["objectivec", "@interface Greeter : NSObject\n@end", ["token", "keyword"]],
  ])("highlights %s code", (language, code, expectedClasses: string[]) => {
    const result = highlightCode(code, language);

    for (const expectedClass of expectedClasses) {
      expect(result).toContain(expectedClass);
    }
  });

  it("returns escaped HTML for unknown languages", () => {
    const code = "some code";
    const result = highlightCode(code, "unknown-language");

    expect(result).toBe("some code");
  });

  it("returns escaped HTML when language is null", () => {
    const code = "some code";
    const result = highlightCode(code, null);

    expect(result).toBe("some code");
  });

  it("escapes HTML entities in unknown languages", () => {
    const code = "<script>alert('xss')</script>";
    const result = highlightCode(code, null);

    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).not.toContain("<script>");
  });

  it("handles undefined input", () => {
    expect(highlightCode(undefined, "javascript")).toBe("");
  });

  it("handles null input", () => {
    expect(highlightCode(null, "typescript")).toBe("");
  });
});
