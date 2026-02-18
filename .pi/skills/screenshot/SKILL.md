---
name: screenshot
description: Capture screenshots of the Recap Tauri app using Peekaboo. Use when needing to take screenshots, capture the UI, or document the app's visual state.
---

# Screenshot

Capture screenshots of the Recap app using [Peekaboo](https://github.com/steipete/Peekaboo).

## Prerequisites

- Peekaboo installed (`brew install steipete/tap/peekaboo`)
- Screen Recording permission granted to the terminal app
- The Recap app running (`gob add bun run tauri dev`)

## Capture Screenshot

```bash
WINDOW_ID=$(peekaboo list windows --app "Recap" --json | jq -r '.data.windows[] | select(.title == "Recap") | .window_id') && \
peekaboo image --mode window --window-id "$WINDOW_ID" --retina --path ~/Desktop/recap-screenshot.png
```

## Notes

- The app has multiple windows; target the one with title "Recap" (the main window)
- Use `--retina` for high-resolution captures
- **Important**: The app must be visible on the active Space. If the terminal is fullscreen (separate Space), the screenshot will be blank. Ask the user to exit fullscreen or switch to the app's Space before capturing.
- Peekaboo requires macOS Screen Recording + Accessibility permissions
