# Agent Guidelines

Instructions for AI coding agents working on this project.

## Package Manager

**Use `bun`, not `npm` or `yarn`.**

```bash
# Install dependencies
bun install

# Add a package
bun add <package>
bun add -d <dev-package>

# Run scripts
bun run dev
bun run build
bun run test

# Tauri commands
bun run tauri dev
bun run tauri build
```

## Task Management

Use `dex` to track tasks:
- `dex show <id> --full` before starting a task
- `dex complete <id> --result "..." --commit <sha>` when done
- See `.dex/` for task history

## Testing

- Frontend: Vitest + React Testing Library (`bun run test`)
- Backend: Rust `#[cfg(test)]` (`cargo test` in `src-tauri/`)
- Always add tests for new functionality

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Zustand, Radix UI
- **Backend**: Tauri 2.0, Rust, git2
- **Testing**: Vitest, React Testing Library

## Code Style

- Use TypeScript strict mode
- Prefer functional components with hooks
- Use Tailwind for styling (no CSS modules)
- Rust: follow standard formatting (`cargo fmt`)
