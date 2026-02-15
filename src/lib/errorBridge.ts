import { invoke } from "@tauri-apps/api/core";

interface FrontendErrorPayload {
  source: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
}

let isInitialized = false;

export async function reportFrontendError(payload: FrontendErrorPayload) {
  try {
    await invoke("report_frontend_error", { report: payload });
  } catch (error) {
    console.error("Failed to report frontend error", error);
  }
}

function getRejectionMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  return JSON.stringify(reason);
}

export function setupGlobalErrorBridge() {
  if (isInitialized) {
    return;
  }

  isInitialized = true;

  window.addEventListener("error", (event) => {
    const message = event.error?.message ?? event.message ?? "Unknown error";
    reportFrontendError({
      source: "window.error",
      message,
      stack: event.error?.stack,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    }).catch(() => undefined);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;

    reportFrontendError({
      source: "window.unhandledrejection",
      message: getRejectionMessage(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      url: window.location.href,
      userAgent: window.navigator.userAgent,
      timestamp: new Date().toISOString(),
    }).catch(() => undefined);
  });
}
