import { describe, it, expect, vi } from "vitest";
import { render, screen } from "./utils";
import { tauriMocks } from "./setup.js";

// Mock react-resizable-panels since it's a complex UI library
vi.mock("react-resizable-panels", () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div data-testid="panel-group">{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  Separator: () => <div data-testid="separator" />,
  useDefaultLayout: () => ({
    getDefaultLayout: () => [20, 25, 55],
    onLayoutChange: vi.fn(),
  }),
}));

describe("Sample Test - Verify Testing Setup", () => {
  it("renders without crashing", async () => {
    const { default: App } = await import("../App");
    render(<App />);
    
    // Just verify the app renders
    expect(document.body).toBeInTheDocument();
  });

  it("jest-dom matchers work", () => {
    render(<div data-testid="test">Hello</div>);
    expect(screen.getByTestId("test")).toHaveTextContent("Hello");
  });

  it("userEvent is available", async () => {
    const handleClick = vi.fn();
    render(<button onClick={handleClick}>Click me</button>);
    
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});

describe("Tauri Mocks", () => {
  it("invoke is mocked and callable", () => {
    expect(vi.isMockFunction(tauriMocks.invoke)).toBe(true);
  });

  it("invoke can be configured to return values", async () => {
    tauriMocks.invoke.mockResolvedValue({ success: true });
    
    const result = await tauriMocks.invoke("test_command", { arg: "value" });
    
    expect(result).toEqual({ success: true });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("test_command", { arg: "value" });
  });

  it("listen is mocked", () => {
    expect(vi.isMockFunction(tauriMocks.listen)).toBe(true);
  });
});
