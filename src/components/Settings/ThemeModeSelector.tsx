import { Monitor, Moon, Sun } from "lucide-react";
import type { ResolvedTheme, ThemeMode } from "../../hooks/useTheme";
import { cn } from "../../lib/utils";

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: "light", label: "Light", icon: Sun },
  { mode: "dark", label: "Dark", icon: Moon },
  { mode: "system", label: "System", icon: Monitor },
];

export interface ThemeModeSelectorProps {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  onModeChange: (mode: ThemeMode) => void;
}

export function ThemeModeSelector({
  mode,
  resolvedTheme: _resolvedTheme,
  onModeChange,
}: ThemeModeSelectorProps) {
  return (
    <div aria-label="Theme mode" role="radiogroup">
      {THEME_OPTIONS.map((option) => {
        const isSelected = mode === option.mode;
        const Icon = option.icon;

        return (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2",
              "transition-colors duration-150",
              isSelected
                ? "bg-bg-active text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
            key={option.mode}
          >
            <input
              checked={isSelected}
              className="sr-only"
              name="theme-mode"
              onChange={() => {
                if (!isSelected) {
                  onModeChange(option.mode);
                }
              }}
              type="radio"
              value={option.mode}
            />
            <Icon aria-hidden="true" className="h-4 w-4" />
            <span className="text-sm">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
