import { AlertTriangle } from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { reportFrontendError } from "../lib/errorBridge";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled React error", error, errorInfo);

    reportFrontendError({
      source: "react-error-boundary",
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    }).catch(() => undefined);
  }

  private readonly handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-primary px-6 text-text-primary">
        <div className="max-w-md rounded-lg border border-panel-border bg-panel-bg p-6 text-center shadow-lg">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-yellow-500" />
          <h1 className="font-semibold text-lg">Something went wrong</h1>
          <p className="mt-2 text-sm text-text-secondary">
            The app hit an unexpected error. Please reload and try again.
          </p>
          <button
            className="mt-4 rounded border border-border-primary bg-bg-secondary px-4 py-2 text-sm hover:bg-bg-hover"
            onClick={this.handleReload}
            type="button"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
