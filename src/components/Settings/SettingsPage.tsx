import { useTheme } from "../../hooks/useTheme";
import { ThemeModeSelector } from "./ThemeModeSelector";

export function SettingsPage() {
  const { mode, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex h-screen flex-col bg-bg-primary p-6 text-text-primary">
      <section>
        <h2 className="mb-3 font-semibold text-sm text-text-secondary uppercase tracking-wider">
          Theme
        </h2>
        <ThemeModeSelector
          mode={mode}
          onModeChange={setTheme}
          resolvedTheme={resolvedTheme}
        />
      </section>
    </div>
  );
}
