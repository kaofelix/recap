import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriMocks } from "../../test/setup";
import { RewriteMessageEditor } from "./RewriteMessageEditor";

describe("RewriteMessageEditor", () => {
  const defaultProps = {
    commitId: "abc123def456",
    repoPath: "/test/repo",
    initialMessage: "",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders summary input and description textarea", () => {
    render(<RewriteMessageEditor {...defaultProps} />);

    expect(screen.getByPlaceholderText("Commit summary")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toBeInTheDocument();
  });

  it("pre-fills summary from single-line message", () => {
    render(
      <RewriteMessageEditor {...defaultProps} initialMessage="Fix the bug" />
    );

    expect(screen.getByPlaceholderText("Commit summary")).toHaveValue(
      "Fix the bug"
    );
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toHaveValue("");
  });

  it("pre-fills summary and description from multi-line message", () => {
    render(
      <RewriteMessageEditor
        {...defaultProps}
        initialMessage={"Summary line\n\nBody paragraph.\nMore body."}
      />
    );

    expect(screen.getByPlaceholderText("Commit summary")).toHaveValue(
      "Summary line"
    );
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toHaveValue("Body paragraph.\nMore body.");
  });

  it("focuses the summary input on mount", () => {
    render(<RewriteMessageEditor {...defaultProps} />);

    expect(screen.getByPlaceholderText("Commit summary")).toHaveFocus();
  });

  it("calls reword_commit with combined message on confirm", async () => {
    tauriMocks.invoke.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <RewriteMessageEditor {...defaultProps} initialMessage="Old summary" />
    );

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

  it("sends summary-only message when description is empty", async () => {
    tauriMocks.invoke.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <RewriteMessageEditor {...defaultProps} initialMessage="Old summary" />
    );

    const summaryInput = screen.getByPlaceholderText("Commit summary");
    await user.clear(summaryInput);
    await user.type(summaryInput, "New summary");

    await user.click(screen.getByRole("button", { name: "Rewrite" }));

    expect(tauriMocks.invoke).toHaveBeenCalledWith("reword_commit", {
      repoPath: "/test/repo",
      commitId: "abc123def456",
      newMessage: "New summary",
    });
  });

  it("disables Rewrite button when summary is empty", () => {
    render(<RewriteMessageEditor {...defaultProps} initialMessage="" />);

    expect(screen.getByRole("button", { name: "Rewrite" })).toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();

    render(<RewriteMessageEditor {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(tauriMocks.invoke).not.toHaveBeenCalledWith(
      "reword_commit",
      expect.anything()
    );
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();

    render(<RewriteMessageEditor {...defaultProps} />);

    await user.keyboard("{Escape}");

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows error state when reword_commit fails", async () => {
    tauriMocks.invoke.mockRejectedValue(new Error("Rebase conflict"));
    const user = userEvent.setup();

    render(
      <RewriteMessageEditor {...defaultProps} initialMessage="Some summary" />
    );

    await user.click(screen.getByRole("button", { name: "Rewrite" }));

    expect(await screen.findByText(/Rebase conflict/)).toBeInTheDocument();
    // Should NOT close on error — let user retry or cancel
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });
});
