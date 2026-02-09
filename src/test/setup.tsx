import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Clear localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn(() =>
  Promise.resolve(() => {
    /* cleanup function - noop */
  })
);
const mockEmit = vi.fn();
const mockOpenerOpen = vi.fn();
const mockDialogOpen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mockListen,
  emit: mockEmit,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  open: mockOpenerOpen,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mockDialogOpen,
}));

// Export mocks for use in tests
export const tauriMocks = {
  invoke: mockInvoke,
  listen: mockListen,
  emit: mockEmit,
  openerOpen: mockOpenerOpen,
  dialogOpen: mockDialogOpen,
};

// Mock react-diff-viewer-continued (has worker bundle issues in test env)
vi.mock("react-diff-viewer-continued", () => ({
  default: ({
    oldValue,
    newValue,
    splitView,
  }: {
    oldValue: string;
    newValue: string;
    splitView: boolean;
  }) => (
    <div data-split-view={splitView} data-testid="diff-viewer">
      <div data-testid="diff-old">{oldValue}</div>
      <div data-testid="diff-new">{newValue}</div>
    </div>
  ),
  DiffMethod: {
    CHARS: "CHARS",
    WORDS: "WORDS",
    LINES: "LINES",
    SENTENCES: "SENTENCES",
  },
}));

// Mock react-resizable-panels
vi.mock("react-resizable-panels", () => ({
  Group: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="panel-group">
      {children}
    </div>
  ),
  Panel: ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <div data-testid={`panel-${id || "unknown"}`}>{children}</div>
  ),
  Separator: () => <div data-testid="panel-separator" />,
  useDefaultLayout: () => ({
    getDefaultLayout: () => [20, 25, 55],
    onLayoutChange: vi.fn(),
  }),
}));
