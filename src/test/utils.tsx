import { act, type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

// Add providers here as needed (e.g., router, state management)
interface ProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: ProvidersProps) {
  return <>{children}</>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Helper to safely reset Zustand store state inside act().
 * Prevents "An update to X inside a test was not wrapped in act(...)" warnings.
 *
 * @example
 * afterEach(async () => {
 *   await resetStoreState(useAppStore, {
 *     repos: [],
 *     selectedRepoId: null,
 *   });
 * });
 */
export async function resetStoreState<T extends object>(
  store: { setState: (state: Partial<T>) => void },
  state: Partial<T>
): Promise<void> {
  await act(async () => {
    store.setState(state);
  });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

// Override render with custom render
export { customRender as render };
