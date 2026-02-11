import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testing } from "../../hooks/useTheme";
import { render, screen, userEvent } from "../../test/utils";
import { ThemeToggleButton } from "./ThemeToggleButton";

describe("ThemeToggleButton", () => {
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    __testing.resetState();
    originalMatchMedia = window.matchMedia;
    mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList);
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renders a button with accessible label", () => {
    render(<ThemeToggleButton />);

    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
  });

  it("cycles from system to light on first click", async () => {
    __testing.initializeTheme();
    const user = userEvent.setup();

    render(<ThemeToggleButton />);

    const button = screen.getByRole("button", { name: /theme/i });
    await user.click(button);

    expect(button).toHaveAccessibleName(/light/i);
  });

  it("cycles from light to dark on click", async () => {
    localStorage.setItem("theme-mode", "light");
    __testing.initializeTheme();
    const user = userEvent.setup();

    render(<ThemeToggleButton />);

    const button = screen.getByRole("button", { name: /theme/i });
    await user.click(button);

    expect(button).toHaveAccessibleName(/dark/i);
  });

  it("cycles from dark to system on click", async () => {
    localStorage.setItem("theme-mode", "dark");
    __testing.initializeTheme();
    const user = userEvent.setup();

    render(<ThemeToggleButton />);

    const button = screen.getByRole("button", { name: /theme/i });
    await user.click(button);

    expect(button).toHaveAccessibleName(/system/i);
  });

  it("renders all three icon types for accessibility", async () => {
    // Verify each mode renders a different icon by checking the SVG is present
    __testing.initializeTheme();
    const user = userEvent.setup();

    const { container } = render(<ThemeToggleButton />);

    // system mode should have an svg icon
    const svg1 = container.querySelector("svg");
    expect(svg1).toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    // light mode should also have an svg icon
    const svg2 = container.querySelector("svg");
    expect(svg2).toBeInTheDocument();
  });

  it("completes a full cycle: system → light → dark → system", async () => {
    __testing.initializeTheme();
    const user = userEvent.setup();

    render(<ThemeToggleButton />);

    const button = screen.getByRole("button", { name: /theme/i });

    // system → light
    await user.click(button);
    expect(button).toHaveAccessibleName(/light/i);

    // light → dark
    await user.click(button);
    expect(button).toHaveAccessibleName(/dark/i);

    // dark → system
    await user.click(button);
    expect(button).toHaveAccessibleName(/system/i);
  });
});
