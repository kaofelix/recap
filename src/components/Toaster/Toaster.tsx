import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ToastType } from "../../store/toastStore";
import { useToastStore } from "../../store/toastStore";

function getToastClasses(type: ToastType) {
  if (type === "warning") {
    return {
      container: "border-warning bg-warning text-black",
      icon: "text-black",
      dismissButton: "text-black/80 hover:bg-black/10 hover:text-black",
    };
  }

  return {
    container: "border-danger bg-danger text-white",
    icon: "text-white",
    dismissButton: "text-white/80 hover:bg-white/10 hover:text-white",
  };
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => {
        const toastClasses = getToastClasses(toast.type);

        return (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
              "min-w-[320px] max-w-[480px]",
              toastClasses.container
            )}
            key={toast.id}
            role="alert"
          >
            <AlertTriangle
              className={cn("mt-0.5 h-4 w-4 shrink-0", toastClasses.icon)}
            />
            <p className="flex-1 select-text whitespace-pre-line text-sm">
              {toast.message}
            </p>
            <button
              aria-label="Dismiss"
              className={cn(
                "shrink-0 rounded p-0.5 transition-colors",
                toastClasses.dismissButton
              )}
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
