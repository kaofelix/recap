#!/usr/bin/env bash
set -euo pipefail

TAG_NAME="${1:-${GITHUB_REF_NAME:-}}"

if [[ -z "$TAG_NAME" && "${GITHUB_REF:-}" == refs/tags/* ]]; then
  TAG_NAME="${GITHUB_REF#refs/tags/}"
fi

# Local pre-push convenience: if no tag provided, check if HEAD is tagged with a release tag.
if [[ -z "$TAG_NAME" ]]; then
  TAG_NAME="$(git tag --points-at HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+([-.+][0-9A-Za-z.-]+)?$' | head -n1 || true)"
fi

if [[ -z "$TAG_NAME" ]]; then
  echo "No release tag detected; skipping release version check."
  exit 0
fi

if [[ ! "$TAG_NAME" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([-.+][0-9A-Za-z.-]+)?$ ]]; then
  echo "Tag '$TAG_NAME' is not a valid release tag (expected vX.Y.Z)."
  exit 1
fi

EXPECTED_VERSION="${TAG_NAME#v}"
PACKAGE_VERSION="$(jq -r '.version' package.json)"
TAURI_VERSION="$(jq -r '.version' src-tauri/tauri.conf.json)"
CARGO_VERSION="$(awk '
  /^\[package\]/ { in_package = 1; next }
  /^\[/ { if (in_package) exit }
  in_package && $1 == "version" {
    gsub(/"/, "", $3)
    print $3
    exit
  }
' src-tauri/Cargo.toml)"

ERRORS=()

if [[ "$PACKAGE_VERSION" != "$EXPECTED_VERSION" ]]; then
  ERRORS+=("package.json version is $PACKAGE_VERSION but tag expects $EXPECTED_VERSION")
fi

if [[ "$TAURI_VERSION" != "$EXPECTED_VERSION" ]]; then
  ERRORS+=("src-tauri/tauri.conf.json version is $TAURI_VERSION but tag expects $EXPECTED_VERSION")
fi

if [[ "$CARGO_VERSION" != "$EXPECTED_VERSION" ]]; then
  ERRORS+=("src-tauri/Cargo.toml version is $CARGO_VERSION but tag expects $EXPECTED_VERSION")
fi

if (( ${#ERRORS[@]} > 0 )); then
  echo "Release version validation failed:"
  for ERROR in "${ERRORS[@]}"; do
    echo "- $ERROR"
  done
  exit 1
fi

echo "Release version validation passed for tag $TAG_NAME"
