import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testing } from "../../hooks/useTheme";
import { useSettingsStore } from "../../store/settingsStore";
import { render, screen, userEvent } from "../../test/utils";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    __testing.resetState();
    useSettingsStore.setState({ themeMode: "system" });

    originalMatchMedia = window.matchMedia;
    mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList);
    document.documentElement.classList.remove("dark");
  });

  afterEach(async () => {
    await act(async () => {
      window.matchMedia = originalMatchMedia;
    });
  });

  it("renders a Theme section heading", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: /theme/i })).toBeInTheDocument();
  });

  it("renders theme mode options", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
  });

  it("reflects the current theme mode", () => {
    useSettingsStore.setState({ themeMode: "dark" });
    render(<SettingsPage />);

    expect(screen.getByRole("radio", { name: /dark/i })).toBeChecked();
  });

  it("changes theme when a different option is selected", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Default is system; click dark
    await user.click(screen.getByRole("radio", { name: /dark/i }));

    expect(screen.getByRole("radio", { name: /dark/i })).toBeChecked();
    expect(useSettingsStore.getState().themeMode).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
