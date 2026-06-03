import "@testing-library/jest-dom/vitest";
import { HotkeyManager } from "@tanstack/react-hotkeys";
import { act, cleanup } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { afterEach, beforeEach, vi } from "vitest";

// Mock IntersectionObserver (not available in jsdom)
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

// Cleanup after each test - wrap in act() to avoid warnings from pending state updates
afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  // Reset TanStack Hotkeys singleton to avoid leaking registrations between tests
  HotkeyManager.resetInstance();
  vi.clearAllMocks();
});

// Mock @radix-ui/react-tooltip to avoid act() warnings in tests
// Radix Tooltip has internal async state that causes warnings in tests
vi.mock("@radix-ui/react-tooltip", async () => {
  const React = await import("react");

  const TooltipProvider = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  const TooltipRoot = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  const TooltipTrigger = ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return React.createElement("button", null, children);
  };

  const TooltipPortal = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  const TooltipContent = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) =>
    React.createElement(
      "div",
      { className, role: "tooltip", "data-testid": "tooltip-content" },
      children
    );

  return {
    Provider: TooltipProvider,
    Root: TooltipRoot,
    Trigger: TooltipTrigger,
    Portal: TooltipPortal,
    Content: TooltipContent,
  };
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

// Mock matchMedia (needed by useTheme)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Clear localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});

// Mock useAppVisibility to always return true in tests (app is visible/focused)
// This ensures polling tests use the fast interval (2s) not the background interval (30s)
vi.mock("../hooks/useAppVisibility", () => ({
  useAppVisibility: () => true,
}));

// Mock useRepoPolling to be a no-op in component tests
// Tests should set up store state directly instead of relying on polling
vi.mock("../hooks/useRepoPolling", () => ({
  useRepoPolling: () => {
    // No-op: tests set up store state directly
  },
}));

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

const mockOpenUrl = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/plugin-opener", () => ({
  open: mockOpenerOpen,
  openUrl: mockOpenUrl,
  revealItemInDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: mockDialogOpen,
}));

// Mock Tauri path API
vi.mock("@tauri-apps/api/path", () => ({
  join: vi.fn((...paths: string[]) => Promise.resolve(paths.join("/"))),
  sep: vi.fn(() => "/"),
}));

// Mock Tauri dpi API
vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

// Mock Tauri menu API
const mockMenuPopup = vi.fn().mockResolvedValue(undefined);
const mockMenuClose = vi.fn().mockResolvedValue(undefined);
const mockMenuItemNew = vi
  .fn()
  .mockImplementation((opts: { id: string; text: string; enabled?: boolean }) =>
    Promise.resolve({
      id: opts.id,
      text: opts.text,
      enabled: opts.enabled,
    })
  );

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn().mockResolvedValue({
      popup: mockMenuPopup,
      close: mockMenuClose,
    }),
  },
  MenuItem: {
    new: (...args: unknown[]) => mockMenuItemNew(...args),
  },
}));

// Export mocks for use in tests
export const tauriMocks = {
  invoke: mockInvoke,
  listen: mockListen,
  emit: mockEmit,
  openerOpen: mockOpenerOpen,
  openUrl: mockOpenUrl,
  dialogOpen: mockDialogOpen,
  menuPopup: mockMenuPopup,
  menuClose: mockMenuClose,
  menuItemNew: mockMenuItemNew,
};

// Mock @pierre/diffs/react (uses browser APIs and workers outside test needs)
vi.mock("@pierre/diffs/react", () => ({
  useWorkerPool: () =>
    (
      globalThis as typeof globalThis & {
        __mockDiffsWorkerPool?: unknown;
      }
    ).__mockDiffsWorkerPool ?? null,
  WorkerPoolContextProvider: ({
    children,
    highlighterOptions,
    poolOptions,
  }: {
    children: React.ReactNode;
    highlighterOptions?: { langs?: string[]; tokenizeMaxLineLength?: number };
    poolOptions?: { poolSize?: number };
  }) => (
    <div
      data-langs={highlighterOptions?.langs?.join(",")}
      data-pool-size={poolOptions?.poolSize}
      data-testid="worker-pool-provider"
      data-tokenize-max-line-length={highlighterOptions?.tokenizeMaxLineLength}
    >
      {children}
    </div>
  ),
  MultiFileDiff: ({
    oldFile,
    newFile,
    options,
    style,
  }: {
    oldFile: { name: string; contents: string; cacheKey?: string };
    newFile: { name: string; contents: string; cacheKey?: string };
    options?: {
      diffStyle?: "split" | "unified";
      overflow?: "wrap" | "scroll";
      theme?: { dark?: string; light?: string } | string;
      themeType?: "dark" | "light" | "system";
      disableFileHeader?: boolean;
      hunkSeparators?: string;
      lineDiffType?: string;
    };
    style?: React.CSSProperties;
  }) => {
    useEffect(() => {
      const globalWithCounter = globalThis as typeof globalThis & {
        __mockDiffsMountCount?: number;
      };
      globalWithCounter.__mockDiffsMountCount =
        (globalWithCounter.__mockDiffsMountCount ?? 0) + 1;
    }, []);

    return (
      <div
        data-diff-style={options?.diffStyle}
        data-disable-file-header={String(Boolean(options?.disableFileHeader))}
        data-hunk-separators={options?.hunkSeparators}
        data-line-diff-type={options?.lineDiffType}
        data-new-cache-key={newFile.cacheKey}
        data-new-file-name={newFile.name}
        data-old-cache-key={oldFile.cacheKey}
        data-old-file-name={oldFile.name}
        data-overflow={options?.overflow}
        data-split-view={String(options?.diffStyle === "split")}
        data-testid="diff-viewer"
        data-theme-dark={
          typeof options?.theme === "object"
            ? options.theme.dark
            : options?.theme
        }
        data-theme-light={
          typeof options?.theme === "object"
            ? options.theme.light
            : options?.theme
        }
        data-theme-type={options?.themeType}
        style={style}
      >
        <div data-testid="diff-old">{oldFile.contents}</div>
        <div data-testid="diff-new">{newFile.contents}</div>
      </div>
    );
  },
}));

// Mock react-resizable-panels
vi.mock("react-resizable-panels", async () => {
  const React = await import("react");

  type Layout = Record<string, number>;

  const DEFAULT_LAYOUT: Layout = {
    sidebar: 20,
    "file-list": 25,
    "diff-view": 55,
  };

  const GroupLayoutContext = React.createContext<{
    layout: Layout;
    setPanelSize: (id: string, size: number) => void;
  } | null>(null);

  function parseSize(value: number | string | undefined): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      if (value.endsWith("%")) {
        return Number.parseFloat(value);
      }
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return 0;
  }

  const Group = ({
    children,
    className,
    defaultLayout,
    groupRef,
  }: {
    children: React.ReactNode;
    className?: string;
    defaultLayout?: Layout;
    groupRef?: React.Ref<{
      getLayout: () => Layout;
      setLayout: (layout: Layout) => Layout;
    }>;
  }) => {
    const [layout, setLayout] = React.useState<Layout>(
      defaultLayout ?? DEFAULT_LAYOUT
    );

    const handle = React.useMemo(
      () => ({
        getLayout: () => layout,
        setLayout: (nextLayout: Layout) => {
          setLayout(nextLayout);
          return nextLayout;
        },
      }),
      [layout]
    );

    useImperativeHandle(groupRef, () => handle, [handle]);

    return (
      <GroupLayoutContext.Provider
        value={{
          layout,
          setPanelSize: (id, size) =>
            setLayout((prev) => ({
              ...prev,
              [id]: size,
            })),
        }}
      >
        <div className={className} data-testid="panel-group">
          {children}
        </div>
      </GroupLayoutContext.Provider>
    );
  };

  const Panel = forwardRef(
    (
      {
        children,
        id,
        panelRef,
        defaultSize,
      }: {
        children: React.ReactNode;
        id?: string;
        defaultSize?: number | string;
        panelRef?: React.Ref<{
          collapse: () => void;
          expand: () => void;
          isCollapsed: () => boolean;
          getSize: () => { asPercentage: number; inPixels: number };
          resize: (size: number | string) => void;
        }>;
      },
      ref
    ) => {
      const groupContext = React.useContext(GroupLayoutContext);
      const panelId = id || "unknown";
      const defaultSizeAsNumber = parseSize(defaultSize);

      const [collapsed, setCollapsed] = useState(false);
      const size =
        groupContext?.layout[panelId] !== undefined
          ? groupContext.layout[panelId]
          : defaultSizeAsNumber;

      const handle = {
        collapse: () => {
          setCollapsed(true);
          groupContext?.setPanelSize(panelId, 0);
        },
        expand: () => {
          setCollapsed(false);
          // Mock historical behavior: expand goes to configured default size.
          // App code should restore exact prior layout explicitly.
          groupContext?.setPanelSize(panelId, defaultSizeAsNumber);
        },
        isCollapsed: () => collapsed,
        getSize: () => ({ asPercentage: size, inPixels: size }),
        resize: (nextSize: number | string) => {
          setCollapsed(false);
          groupContext?.setPanelSize(panelId, parseSize(nextSize));
        },
      };

      useImperativeHandle(ref, () => handle);
      useImperativeHandle(panelRef, () => handle);

      return (
        <div
          data-collapsed={String(collapsed)}
          data-size={String(size)}
          data-testid={`panel-${panelId}`}
        >
          {children}
        </div>
      );
    }
  );

  return {
    Group,
    Panel,
    Separator: () => <div data-testid="panel-separator" />,
    useDefaultLayout: ({ id }: { id: string }) => {
      const storageKey = `mock-panel-layout:${id}`;
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? (JSON.parse(stored) as Layout) : DEFAULT_LAYOUT;

      return {
        defaultLayout: parsed,
        onLayoutChanged: (layout: Layout) => {
          localStorage.setItem(storageKey, JSON.stringify(layout));
        },
      };
    },
  };
});
