#!/bin/bash
# Build app icons from Icon Composer export
# Usage: ./scripts/build-icon.sh <exported-icon.png>
#
# Adds proper macOS padding (~20%) and generates all Tauri icon formats.

set -e

SOURCE="${1:-}"
OUTPUT="assets/app-icon-1024.png"

if [ -z "$SOURCE" ]; then
  echo "Usage: ./scripts/build-icon.sh <icon-composer-export.png>"
  echo ""
  echo "Export from Icon Composer:"
  echo "  1. Open your .icon file"
  echo "  2. File → Export as PNG"
  echo "  3. Run this script with the exported file"
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  echo "Error: File not found: $SOURCE"
  exit 1
fi

echo "Building icons from $SOURCE..."

# Scale to 80% and center on 1024x1024 canvas for proper macOS padding
TEMP_ICON=$(mktemp).png
sips -z 820 820 "$SOURCE" --out "$TEMP_ICON" >/dev/null
sips -p 1024 1024 "$TEMP_ICON" --out "$OUTPUT" >/dev/null
rm -f "$TEMP_ICON"

echo "✓ Created padded icon: $OUTPUT"

# Generate all Tauri icon formats
bun run tauri icon "$OUTPUT"

echo ""
echo "✓ Done! Icons generated in src-tauri/icons/"
