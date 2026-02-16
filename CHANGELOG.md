# Changelog

All notable changes to Recap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
