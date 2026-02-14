import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  parseCargoPackageVersion,
  validateReleaseVersions,
} from "../src/lib/releaseVersion";

function resolveTagName(): string | null {
  const cliTag = process.argv[2];
  if (cliTag) {
    return cliTag;
  }

  const githubRefName = process.env.GITHUB_REF_NAME;
  if (githubRefName) {
    return githubRefName;
  }

  const githubRef = process.env.GITHUB_REF;
  if (githubRef?.startsWith("refs/tags/")) {
    return githubRef.replace("refs/tags/", "");
  }

  return null;
}

function run(): number {
  const tagName = resolveTagName();

  if (!tagName) {
    console.error(
      "Missing release tag. Provide one as the first argument or set GITHUB_REF_NAME."
    );
    return 1;
  }

  const packageJsonPath = resolve(process.cwd(), "package.json");
  const tauriConfigPath = resolve(process.cwd(), "src-tauri/tauri.conf.json");
  const cargoTomlPath = resolve(process.cwd(), "src-tauri/Cargo.toml");

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };
  const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8")) as {
    version?: string;
  };
  const cargoVersion = parseCargoPackageVersion(
    readFileSync(cargoTomlPath, "utf8")
  );

  if (!packageJson.version) {
    console.error("package.json does not contain a version field");
    return 1;
  }

  if (!tauriConfig.version) {
    console.error("src-tauri/tauri.conf.json does not contain a version field");
    return 1;
  }

  if (!cargoVersion) {
    console.error(
      "Could not parse [package].version from src-tauri/Cargo.toml"
    );
    return 1;
  }

  const result = validateReleaseVersions({
    tagName,
    packageJsonVersion: packageJson.version,
    tauriVersion: tauriConfig.version,
    cargoVersion,
  });

  if (!result.ok) {
    console.error("Release version validation failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  console.log(`Release version validation passed for tag ${tagName}`);
  return 0;
}

process.exit(run());
