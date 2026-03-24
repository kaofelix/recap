# Changelog

All notable changes to Recap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.2] - 2026-03-24

### Fixed

- **More reliable commit avatars** — Commit history now resolves each author avatar once and reuses that result across matching commits, avoiding inconsistent cases where the same author showed an avatar in some rows and initials in others.

## [0.4.1] - 2026-03-24

### Fixed

- **Refresh now keeps the selected file** — Fixed a regression where refreshing while reviewing changes could jump the cursor to the first file and leave the diff panel empty.

## [0.4.0] - 2026-03-19

### Added

- **Uncommitted changes in History** — Your working tree now appears as a dedicated **Uncommitted changes** item at the top of History, so you can move between commits and in-progress changes from one list.
- **Commit from the Files panel** — You can now stage files, use **Stage All** / **Unstage All**, and create a commit directly from the Files panel while reviewing uncommitted changes.
- **Rewrite unpushed commit messages** — Right-click an unpushed commit to edit its message inline.
- **Author filtering in History** — You can now filter commit history by author, search by name or email, and keep browsing long histories with infinite scroll.
- **Ahead/behind branch status** — History now shows when your branch is ahead of or behind its upstream.
- **Branch picker stays in sync** — The branch picker now updates to reflect the currently checked-out branch.

### Fixed

- **More accurate pushed/unpushed status** — Pushed and unpushed commit indicators now stay correct even when your branch has diverged from upstream.

## [0.3.1] - 2026-03-18

### Fixed

- Fixed empty "Unstaged Changes" section header appearing when all unstaged files are untracked.

## [0.3.0] - 2026-03-16

### Added

- **Author avatars in history** — Commit history items now show a Gravatar avatar and the author name alongside the SHA and timestamp.

- **Open in Forge** — Right-click a commit in the history list to open it in your git forge (GitHub, GitLab, Bitbucket) in the browser. Automatically detects the forge from your origin remote URL.

- **Pushed / unpushed indicator** — A divider line marks where your local commits end and pushed commits begin. Unpushed commits appear slightly faded so you can tell at a glance what hasn't been pushed yet. "Open in Forge" is disabled for unpushed commits.

## [0.2.8] - 2026-03-04

### Fixed

- **Critical CPU fix** — Fixed a bug causing ~80% CPU usage when viewing diffs in Changes mode. An unstable array reference was triggering file content re-fetches ~70 times per second instead of only when needed.

## [0.2.7] - 2026-03-04

### Added

- **Context menus** — Right-click (or press the Menu key / Shift+F10) on commits and files for quick actions:
  - History list: Copy Commit Hash
  - File lists: Copy Relative Path, Copy Full Path, Reveal in Finder
  - Changes view: Unstage (for staged files) or Discard Changes (for unstaged/untracked files)

- **Untracked files subsection** — Untracked files now appear in a dedicated "Untracked" subsection within Unstaged Changes for better organization.

### Improved

- **Staged and unstaged selection** — When the same file has both staged and unstaged changes, each section is now independently selectable to view the correct diff.

- **Update check feedback** — Added a spinner while checking for updates and a brief "Up to date!" confirmation message.

- **Reduced idle CPU usage** — Consolidated multiple polling intervals into a single unified loop with visibility awareness. The app now polls every 2 seconds when focused, but slows to 30 seconds when minimized or in the background.

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
