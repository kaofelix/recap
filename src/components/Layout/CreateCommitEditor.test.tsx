import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriMocks } from "../../test/setup";
import { CreateCommitEditor } from "./CreateCommitEditor";

describe("CreateCommitEditor", () => {
  const defaultProps = {
    repoPath: "/test/repo",
    onCommitted: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with Commit as the submit button label", () => {
    render(<CreateCommitEditor {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("calls create_commit with the message and fires onCommitted on success", async () => {
    tauriMocks.invoke.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CreateCommitEditor {...defaultProps} />);

    const summaryInput = screen.getByPlaceholderText("Commit summary");
    await user.type(summaryInput, "feat: new feature");

    const descInput = screen.getByPlaceholderText(
      "Extended description (optional)"
    );
    await user.type(descInput, "Detailed description");

    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(tauriMocks.invoke).toHaveBeenCalledWith("create_commit", {
      repoPath: "/test/repo",
      message: "feat: new feature\n\nDetailed description",
    });
    expect(defaultProps.onCommitted).toHaveBeenCalled();
  });

  it("shows error and does not fire onCommitted when create_commit fails", async () => {
    tauriMocks.invoke.mockRejectedValue(
      new Error("No staged changes to commit")
    );
    const user = userEvent.setup();

    render(<CreateCommitEditor {...defaultProps} />);

    const summaryInput = screen.getByPlaceholderText("Commit summary");
    await user.type(summaryInput, "attempt");

    await user.click(screen.getByRole("button", { name: "Commit" }));

    expect(
      await screen.findByText(/No staged changes to commit/)
    ).toBeInTheDocument();
    expect(defaultProps.onCommitted).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked without invoking backend", async () => {
    const user = userEvent.setup();

    render(<CreateCommitEditor {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(defaultProps.onCancel).toHaveBeenCalled();
    expect(tauriMocks.invoke).not.toHaveBeenCalledWith(
      "create_commit",
      expect.anything()
    );
  });

  it("clears the form fields after a successful commit", async () => {
    tauriMocks.invoke.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CreateCommitEditor {...defaultProps} />);

    const summaryInput = screen.getByPlaceholderText("Commit summary");
    await user.type(summaryInput, "feat: new feature");

    await user.click(screen.getByRole("button", { name: "Commit" }));

    // After successful commit, form is remounted — re-query to get the fresh input
    const freshSummaryInput = screen.getByPlaceholderText("Commit summary");
    expect(freshSummaryInput).toHaveValue("");
  });
});
