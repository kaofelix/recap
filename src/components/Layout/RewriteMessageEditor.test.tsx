import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriMocks } from "../../test/setup";
import { RewriteMessageEditor } from "./RewriteMessageEditor";

describe("RewriteMessageEditor", () => {
  const defaultProps = {
    commitId: "abc123def456",
    repoPath: "/test/repo",
    initialMessage: "Old summary",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with Rewrite as the submit button label", () => {
    render(<RewriteMessageEditor {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Rewrite" })).toBeInTheDocument();
  });

  it("calls reword_commit with the new message and closes on success", async () => {
    tauriMocks.invoke.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<RewriteMessageEditor {...defaultProps} />);

    const summaryInput = screen.getByPlaceholderText("Commit summary");
    await user.clear(summaryInput);
    await user.type(summaryInput, "New summary");

    const descInput = screen.getByPlaceholderText(
      "Extended description (optional)"
    );
    await user.type(descInput, "New body");

    await user.click(screen.getByRole("button", { name: "Rewrite" }));

    expect(tauriMocks.invoke).toHaveBeenCalledWith("reword_commit", {
      repoPath: "/test/repo",
      commitId: "abc123def456",
      newMessage: "New summary\n\nNew body",
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows error and does not close when reword_commit fails", async () => {
    tauriMocks.invoke.mockRejectedValue(new Error("Rebase conflict"));
    const user = userEvent.setup();

    render(<RewriteMessageEditor {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Rewrite" }));

    expect(await screen.findByText(/Rebase conflict/)).toBeInTheDocument();
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked without invoking backend", async () => {
    const user = userEvent.setup();

    render(<RewriteMessageEditor {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(tauriMocks.invoke).not.toHaveBeenCalledWith(
      "reword_commit",
      expect.anything()
    );
  });
});
