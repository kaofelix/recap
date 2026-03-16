import { invoke } from "@tauri-apps/api/core";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";

export interface RewriteMessageEditorProps {
  commitId: string;
  repoPath: string;
  initialMessage: string;
  onClose: () => void;
}

/**
 * Parse a full commit message into summary and body parts.
 * The summary is the first line; the body is everything after
 * the first blank line separator.
 */
function parseCommitMessage(message: string): {
  summary: string;
  body: string;
} {
  const lines = message.split("\n");
  const summary = lines[0] ?? "";

  // Find body: skip summary line, skip blank separator line(s)
  let bodyStart = 1;
  while (bodyStart < lines.length && lines[bodyStart].trim() === "") {
    bodyStart++;
  }

  const body =
    bodyStart < lines.length ? lines.slice(bodyStart).join("\n") : "";
  return { summary, body };
}

/**
 * Combine summary and body into a full commit message.
 * If body is non-empty, separates them with a blank line.
 */
function buildCommitMessage(summary: string, body: string): string {
  const trimmedBody = body.trim();
  if (trimmedBody) {
    return `${summary}\n\n${trimmedBody}`;
  }
  return summary;
}

/**
 * Inline editor for rewriting a commit message.
 * Renders at the bottom of the sidebar history list,
 * with a summary input and optional description textarea.
 */
export function RewriteMessageEditor({
  commitId,
  repoPath,
  initialMessage,
  onClose,
}: RewriteMessageEditorProps) {
  const { summary: initialSummary, body: initialBody } =
    parseCommitMessage(initialMessage);

  const [summary, setSummary] = useState(initialSummary);
  const [body, setBody] = useState(initialBody);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summaryRef = useRef<HTMLInputElement>(null);

  // Focus the summary input on mount
  useEffect(() => {
    summaryRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedSummary = summary.trim();
    if (!trimmedSummary || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newMessage = buildCommitMessage(trimmedSummary, body);
      await invoke("reword_commit", {
        repoPath,
        commitId,
        newMessage,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [summary, body, commitId, repoPath, isSubmitting, onClose]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  const canSubmit = summary.trim().length > 0 && !isSubmitting;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: editor panel handles Escape globally
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: editor panel handles Escape globally
    <div
      className={cn(
        "flex flex-col gap-2 border-panel-border border-t p-2",
        "bg-panel-header-bg"
      )}
      data-testid="rewrite-message-editor"
      onKeyDown={handleKeyDown}
    >
      {/* Summary line */}
      <input
        className={cn(
          "w-full rounded border border-panel-border bg-bg-primary px-2 py-1",
          "text-sm text-text-primary placeholder:text-text-secondary/50",
          "focus:border-accent-primary focus:outline-none"
        )}
        disabled={isSubmitting}
        maxLength={72}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Commit summary"
        ref={summaryRef}
        type="text"
        value={summary}
      />

      {/* Description body */}
      <textarea
        className={cn(
          "w-full resize-none rounded border border-panel-border bg-bg-primary px-2 py-1",
          "text-sm text-text-primary placeholder:text-text-secondary/50",
          "focus:border-accent-primary focus:outline-none"
        )}
        disabled={isSubmitting}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Extended description (optional)"
        rows={3}
        value={body}
      />

      {/* Error message */}
      {error && <div className="text-red-500 text-xs">{error}</div>}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          className={cn(
            "rounded px-3 py-1 text-xs",
            "text-text-secondary hover:text-text-primary"
          )}
          disabled={isSubmitting}
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className={cn(
            "rounded px-3 py-1 font-medium text-xs",
            "bg-accent-primary text-white",
            "hover:bg-accent-primary/90",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          disabled={!canSubmit}
          onClick={handleSubmit}
          type="button"
        >
          Rewrite
        </button>
      </div>
    </div>
  );
}
