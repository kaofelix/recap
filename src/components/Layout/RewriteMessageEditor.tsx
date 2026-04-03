import { useCallback, useState } from "react";
import { rewordCommit } from "../../api/commands";
import { CommitMessageForm } from "./CommitMessageForm";

export interface RewriteMessageEditorProps {
  commitId: string;
  repoPath: string;
  initialMessage: string;
  onClose: () => void;
}

/**
 * Inline editor for rewriting a commit message.
 * Renders at the bottom of the sidebar history list.
 * Thin wrapper around CommitMessageForm that handles the reword_commit invoke.
 */
export function RewriteMessageEditor({
  commitId,
  repoPath,
  initialMessage,
  onClose,
}: RewriteMessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (newMessage: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        await rewordCommit(repoPath, commitId, newMessage);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [commitId, repoPath, onClose]
  );

  return (
    <CommitMessageForm
      error={error}
      initialMessage={initialMessage}
      isSubmitting={isSubmitting}
      onCancel={onClose}
      onSubmit={handleSubmit}
      submitLabel="Rewrite"
    />
  );
}
