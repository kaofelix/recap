export interface ReleaseVersionInput {
  tagName: string;
  packageJsonVersion: string;
  tauriVersion: string;
  cargoVersion: string;
}

interface ReleaseVersionValidationResult {
  ok: boolean;
  errors: string[];
}

const RELEASE_TAG_PATTERN =
  /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;

export function extractVersionFromTag(tagName: string): string | null {
  const match = tagName.trim().match(RELEASE_TAG_PATTERN);
  return match ? match[1] : null;
}

export function parseCargoPackageVersion(
  cargoTomlContent: string
): string | null {
  const packageSectionMatch = cargoTomlContent.match(
    /\[package\]([\s\S]*?)(?:\n\[|$)/
  );

  if (!packageSectionMatch) {
    return null;
  }

  const versionMatch = packageSectionMatch[1].match(
    /^\s*version\s*=\s*"([^"]+)"\s*$/m
  );
  return versionMatch ? versionMatch[1] : null;
}

export function validateReleaseVersions(
  input: ReleaseVersionInput
): ReleaseVersionValidationResult {
  const expectedVersion = extractVersionFromTag(input.tagName);

  if (!expectedVersion) {
    return {
      ok: false,
      errors: [
        `tag ${input.tagName} is not a valid release tag (expected format vX.Y.Z)`,
      ],
    };
  }

  const errors: string[] = [];

  if (input.packageJsonVersion !== expectedVersion) {
    errors.push(
      `package.json version is ${input.packageJsonVersion} but tag expects ${expectedVersion}`
    );
  }

  if (input.tauriVersion !== expectedVersion) {
    errors.push(
      `src-tauri/tauri.conf.json version is ${input.tauriVersion} but tag expects ${expectedVersion}`
    );
  }

  if (input.cargoVersion !== expectedVersion) {
    errors.push(
      `src-tauri/Cargo.toml version is ${input.cargoVersion} but tag expects ${expectedVersion}`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
