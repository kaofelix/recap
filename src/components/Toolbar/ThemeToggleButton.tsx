import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/20/solid";
import { useEffect, useRef, useState } from "react";
import { type ThemeMode, useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/utils";

const CYCLE_ORDER: ThemeMode[] = ["system", "light", "dark"];

function nextMode(current: ThemeMode): ThemeMode {
  const index = CYCLE_ORDER.indexOf(current);
  return CYCLE_ORDER[(index + 1) % CYCLE_ORDER.length];
}

const LABELS: Record<ThemeMode, string> = {
  light: "Theme: light",
  dark: "Theme: dark",
  system: "Theme: system",
};

const ICONS: Record<ThemeMode, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: ComputerDesktopIcon,
};

export interface ThemeToggleButtonProps {
  className?: string;
}

export function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const { mode, setTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const prevModeRef = useRef(mode);

  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  const handleClick = () => {
    setTheme(nextMode(mode));
  };

  const Icon = ICONS[mode];

  return (
    <button
      aria-label={LABELS[mode]}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded",
        "text-text-secondary hover:text-text-primary",
        "hover:bg-bg-hover active:bg-bg-active",
        "transition-colors duration-150",
        className
      )}
      onClick={handleClick}
      type="button"
    >
      <Icon
        className={cn(
          "h-4 w-4 transition-transform duration-200",
          isAnimating && "animate-theme-icon"
        )}
      />
    </button>
  );
}
