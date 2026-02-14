import { describe, expect, it } from "vitest";
import {
  extractVersionFromTag,
  parseCargoPackageVersion,
  validateReleaseVersions,
} from "./releaseVersion";

describe("releaseVersion", () => {
  it("extracts version from a semantic version tag", () => {
    expect(extractVersionFromTag("v0.1.3")).toBe("0.1.3");
    expect(extractVersionFromTag("v1.2.3-beta.1")).toBe("1.2.3-beta.1");
  });

  it("returns null for non-release tags", () => {
    expect(extractVersionFromTag("main")).toBeNull();
    expect(extractVersionFromTag("release-0.1.3")).toBeNull();
  });

  it("parses package version from Cargo.toml package section", () => {
    const cargoToml = `
[package]
name = "recap"
version = "0.1.3"

[dependencies]
serde = { version = "1" }
`;

    expect(parseCargoPackageVersion(cargoToml)).toBe("0.1.3");
  });

  it("returns mismatches when versions do not match the tag", () => {
    const result = validateReleaseVersions({
      tagName: "v0.1.3",
      packageJsonVersion: "0.1.2",
      tauriVersion: "0.1.3",
      cargoVersion: "0.1.1",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "package.json version is 0.1.2 but tag expects 0.1.3",
      "src-tauri/Cargo.toml version is 0.1.1 but tag expects 0.1.3",
    ]);
  });

  it("passes when all versions match the tag", () => {
    const result = validateReleaseVersions({
      tagName: "v0.1.3",
      packageJsonVersion: "0.1.3",
      tauriVersion: "0.1.3",
      cargoVersion: "0.1.3",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
