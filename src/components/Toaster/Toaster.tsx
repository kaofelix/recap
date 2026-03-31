import { AlertTriangle, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useToastStore } from "../../store/toastStore";

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg",
            "border-red-500/30 bg-red-950/90 text-red-200",
            "min-w-[320px] max-w-[480px]"
          )}
          key={toast.id}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="flex-1 select-text text-sm">{toast.message}</p>
          <button
            aria-label="Dismiss"
            className={cn(
              "shrink-0 rounded p-0.5",
              "text-red-400 hover:text-red-200",
              "hover:bg-red-900/50",
              "transition-colors"
            )}
            onClick={() => dismissToast(toast.id)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
