import { describe, expect, it } from "vitest";
import { getLanguageFromPath, highlightCode } from "./syntax";

describe("getLanguageFromPath", () => {
  it("detects TypeScript files", () => {
    expect(getLanguageFromPath("src/app.ts")).toBe("typescript");
    expect(getLanguageFromPath("src/app.tsx")).toBe("tsx");
  });

  it("detects JavaScript files", () => {
    expect(getLanguageFromPath("src/app.js")).toBe("javascript");
    expect(getLanguageFromPath("src/app.jsx")).toBe("jsx");
  });

  it("detects Rust files", () => {
    expect(getLanguageFromPath("src/main.rs")).toBe("rust");
  });

  it("detects Python files", () => {
    expect(getLanguageFromPath("script.py")).toBe("python");
  });

  it("detects CSS files", () => {
    expect(getLanguageFromPath("styles.css")).toBe("css");
    expect(getLanguageFromPath("styles.scss")).toBe("scss");
  });

  it("detects HTML files", () => {
    expect(getLanguageFromPath("index.html")).toBe("markup");
  });

  it("detects JSON files", () => {
    expect(getLanguageFromPath("package.json")).toBe("json");
  });

  it("detects YAML files", () => {
    expect(getLanguageFromPath("config.yml")).toBe("yaml");
    expect(getLanguageFromPath("config.yaml")).toBe("yaml");
  });

  it("detects Markdown files", () => {
    expect(getLanguageFromPath("README.md")).toBe("markdown");
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
  it("highlights JavaScript code", () => {
    const code = "const x = 1;";
    const result = highlightCode(code, "javascript");

    expect(result).toContain("token");
    expect(result).toContain("keyword");
  });

  it("highlights TypeScript code", () => {
    const code = "const x: number = 1;";
    const result = highlightCode(code, "typescript");

    expect(result).toContain("token");
  });

  it("highlights Rust code", () => {
    const code = "fn main() {}";
    const result = highlightCode(code, "rust");

    expect(result).toContain("token");
    expect(result).toContain("keyword");
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
});
