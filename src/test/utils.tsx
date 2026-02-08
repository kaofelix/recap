import { render, RenderOptions } from "@testing-library/react";
import { ReactElement, ReactNode } from "react";

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

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

// Override render with custom render
export { customRender as render };
