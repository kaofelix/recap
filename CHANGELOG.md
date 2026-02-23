# Changelog

All notable changes to Recap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.6] - 2026-02-23

### Fixed

- **Diff viewer expand button** — Restored the expand/collapse button in diff folded context sections that was accidentally hidden when virtualization was enabled.

## [0.2.5] - 2026-02-23

### Improved

- **Diff viewer scroll performance** — Enabled virtualization so only visible lines are rendered, significantly improving performance when scrolling through large diffs.

## [0.2.4] - 2026-02-23

### Added

- **Check for Updates menu action** — Added `Recap → Check for Updates…` in the app menu.

### Changed

- **More discreet update status UI** — Replaced the bottom-right updater toast with a subtle inline status message in the toolbar.
- When an update is available, the toolbar now shows an underlined **Update and restart** action.

## [0.2.3] - 2026-02-22

### Added

- **Keyboard shortcut to toggle Diff Focus** — Press `]` to maximize/restore the diff panel quickly.

### Fixed

- **Updater reliability** — Corrected updater endpoint and app permissions so update checks work reliably.
- **Updater error notification dismissal** — The update error toast can now be dismissed correctly.

## [0.2.2] - 2026-02-19

### Added

- **Automatic updates** — The app now checks for updates on launch and shows a notification when a new version is available. Click "Install" to download and relaunch.

## [0.2.1] - 2026-02-19

### Added

- **File navigation in Diff Focus** — When the diff panel is maximized, use the ↑/↓ arrow buttons in the header (or keyboard arrow keys) to move between files without leaving the focused view.
- Diff header now shows the directory path in a muted color so the filename stands out.

### Fixed

- Sidebar width is now preserved when switching between History and Changes views.

## [0.2.0] - 2026-02-18

### Added

- **Multi-commit range selection** — Select a range of commits to view a combined diff across all selected commits.
- **Split/Unified diff toggle** — Press `|` to switch between split and unified diff views.
- **More syntax highlighting** — Swift, Ruby, C, C++, Objective-C, Dockerfile, and Makefile now have syntax highlighting in the diff view.
- Sidebar panels can now be resized to a smaller minimum width.

### Fixed

- Changes view now selects the first diff automatically on open.
- History view now refreshes when the repository updates in the background.
- Dark mode: improved contrast in diff gutter hover and line details.

## [0.1.6] - 2026-02-16

### Fixed

- Resolved TypeScript build regressions in error-boundary and navigation tests that blocked release builds.
- Enforced `pre-push` quality gates with `bun run build` and `bun run test` via Lefthook.

## [0.1.5] - 2026-02-16

### Fixed

- When you move through commits and files with the keyboard, the selected item now stays in view automatically.

## [0.1.4] - 2026-02-15

### Added

- **Diff Focus Mode**
  - Toggle a focused diff view directly from the diff header
  - Keyboard shortcut support for toggling diff focus (**⌘+Enter** / **Ctrl+Enter**)

## [0.1.0] - 2025-02-11

### Added

- **Repository Management**
  - Open and switch between multiple Git repositories
  - Native folder picker for repository selection
  - Remove repositories with confirmation dialog

- **Commit History View**
  - Browse commit history in a scrollable sidebar
  - View commit message, author, and date
  - See list of changed files for each commit

- **Changes View**
  - View uncommitted working directory changes
  - Auto-refresh every 2 seconds to stay current
  - Auto-select first file when viewing changes

- **Diff Viewer**
  - Side-by-side (split) and unified diff views
  - GitHub-inspired syntax highlighting
  - Word wrap toggle for long lines
  - Line numbers with proper alignment
  - Automatic unified view for new/deleted files

- **Branch Support**
  - Branch picker UI component
  - List and checkout branches

- **User Interface**
  - Three-panel resizable layout
  - Light, dark, and system theme support with toggle button
  - Styled tooltips for truncated file paths
  - Lucide React icons throughout
  - Keyboard-accessible panel dividers

### Technical

- Built with Tauri 2.0, React 19, and TypeScript
- Rust backend using git2 for Git operations
- Tailwind CSS for styling
- Zustand for state management
- Vitest + React Testing Library for testing
