import { useCallback, useState } from "react";
import { createCommit } from "../../api/commands";
import { CommitMessageForm } from "./CommitMessageForm";

export interface CreateCommitEditorProps {
  repoPath: string;
  /** Called after a successful commit */
  onCommitted: () => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

/**
 * Inline editor for creating a new commit from staged changes.
 * Thin wrapper around CommitMessageForm that handles the create_commit invoke.
 */
export function CreateCommitEditor({
  repoPath,
  onCommitted,
  onCancel,
}: CreateCommitEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = useCallback(
    async (message: string) => {
      setIsSubmitting(true);
      setError(null);

      try {
        await createCommit(repoPath, message);
        // Reset the form by changing the key
        setFormKey((k) => k + 1);
        onCommitted();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [repoPath, onCommitted]
  );

  return (
    <CommitMessageForm
      error={error}
      isSubmitting={isSubmitting}
      key={formKey}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      submitLabel="Commit"
    />
  );
}
