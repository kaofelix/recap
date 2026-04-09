import { describe, expect, it, vi } from "vitest";
import type { ResolvedTheme, ThemeMode } from "../../hooks/useTheme";
import { render, screen, userEvent } from "../../test/utils";
import { ThemeModeSelector } from "./ThemeModeSelector";

describe("ThemeModeSelector", () => {
  const defaultProps = {
    mode: "system" as ThemeMode,
    resolvedTheme: "light" as ResolvedTheme,
    onModeChange: vi.fn(),
  };

  it("renders Light, Dark, and System options", () => {
    render(<ThemeModeSelector {...defaultProps} />);

    expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
  });

  it("marks the current mode as checked", () => {
    render(<ThemeModeSelector {...defaultProps} mode="dark" />);

    expect(screen.getByRole("radio", { name: /dark/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /light/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /system/i })).not.toBeChecked();
  });

  it("calls onModeChange with 'light' when Light is clicked", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();

    render(<ThemeModeSelector {...defaultProps} onModeChange={onModeChange} />);

    await user.click(screen.getByRole("radio", { name: /light/i }));
    expect(onModeChange).toHaveBeenCalledWith("light");
  });

  it("calls onModeChange with 'dark' when Dark is clicked", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();

    render(<ThemeModeSelector {...defaultProps} onModeChange={onModeChange} />);

    await user.click(screen.getByRole("radio", { name: /dark/i }));
    expect(onModeChange).toHaveBeenCalledWith("dark");
  });

  it("calls onModeChange with 'system' when System is clicked", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeModeSelector
        {...defaultProps}
        mode="light"
        onModeChange={onModeChange}
      />
    );

    await user.click(screen.getByRole("radio", { name: /system/i }));
    expect(onModeChange).toHaveBeenCalledWith("system");
  });

  it("does not call onModeChange when clicking the already-selected mode", async () => {
    const onModeChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeModeSelector
        {...defaultProps}
        mode="dark"
        onModeChange={onModeChange}
      />
    );

    await user.click(screen.getByRole("radio", { name: /dark/i }));
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
