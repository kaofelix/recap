---
name: webdriver
description: Automate and debug the Recap Tauri app via WebDriver. Use when needing to interact with the app programmatically, inspect DOM state, execute JavaScript in the webview, take screenshots via WebDriver, or run e2e tests.
---

# WebDriver Automation

Interact with the running Recap app via [tauri-plugin-webdriver](https://github.com/Choochmeque/tauri-plugin-webdriver) (W3C WebDriver on macOS).

## Setup

The plugin is an optional Cargo dependency behind the `webdriver` feature flag.

### Start the app with WebDriver

```bash
gob add bun run tauri dev -- --features webdriver
```

The WebDriver server starts on `http://127.0.0.1:4445`. Verify:

```bash
curl -s http://127.0.0.1:4445/status
```

### Connect with WebdriverIO

`webdriverio` is a dev dependency in the project.

```typescript
import { remote } from "webdriverio";

const browser = await remote({
  hostname: "127.0.0.1",
  port: 4445,
  capabilities: {},
  logLevel: "warn",
});

// Execute JS in the webview
const result = await browser.executeScript(`return document.title`, []);

// Take a screenshot
await browser.saveScreenshot("screenshot.png");

// Clean up
await browser.deleteSession();
```

## Common Patterns

### Execute JavaScript in the webview

```typescript
const result = await browser.executeScript(`
  // Access the app's DOM directly
  const el = document.querySelector('.some-selector');
  return { text: el?.textContent, rect: el?.getBoundingClientRect() };
`, []);
```

Pass arguments via the second array parameter — available as `arguments[0]`, `arguments[1]`, etc.

### Find and interact with elements

```typescript
const el = await browser.$('#my-button');
await el.click();
await el.setValue('some text');
const text = await el.getText();
```

### Screenshots

```typescript
await browser.saveScreenshot("path/to/screenshot.png");
```

## Caveats

- `executeScript` is synchronous (W3C `execute/sync`). Returning a Promise or using `await` in the script body will fail. For async work, do it synchronously or break into multiple `executeScript` calls.
- The plugin is debug-only — never include in release builds. The `webdriver` feature flag keeps it out of production.
- E2E test scripts live in `e2e/` (gitignored). They require manual app setup — no CI integration yet.

## Architecture

- **Rust**: `tauri-plugin-webdriver` registered conditionally in `src-tauri/src/lib.rs` via `#[cfg(feature = "webdriver")]`
- **Cargo.toml**: Optional dependency under `[features] webdriver = ["dep:tauri-plugin-webdriver"]`
- **Port**: 4445 (plugin default)
