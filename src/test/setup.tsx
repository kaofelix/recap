import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useState } from "react";
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
    renderContent,
  }: {
    oldValue: string;
    newValue: string;
    splitView: boolean;
    renderContent?: (source: string) => React.ReactElement;
  }) => {
    // If renderContent is provided, use it to render the content
    const renderValue = (value: string) => {
      if (renderContent) {
        return renderContent(value);
      }
      return value;
    };

    return (
      <div data-split-view={splitView} data-testid="diff-viewer">
        <div data-testid="diff-old">{renderValue(oldValue)}</div>
        <div data-testid="diff-new">{renderValue(newValue)}</div>
      </div>
    );
  },
  DiffMethod: {
    CHARS: "CHARS",
    WORDS: "WORDS",
    LINES: "LINES",
    SENTENCES: "SENTENCES",
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
