import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitMessageForm } from "./CommitMessageForm";

describe("CommitMessageForm", () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    submitLabel: "Submit",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────

  it("renders summary input and description textarea", () => {
    render(<CommitMessageForm {...defaultProps} />);

    expect(screen.getByPlaceholderText("Commit summary")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toBeInTheDocument();
  });

  it("renders the provided submitLabel on the submit button", () => {
    render(<CommitMessageForm {...defaultProps} submitLabel="Commit" />);

    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("always renders a Cancel button", () => {
    render(<CommitMessageForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  // ── Initial values ─────────────────────────────────────────

  it("pre-fills summary from single-line initialMessage", () => {
    render(
      <CommitMessageForm {...defaultProps} initialMessage="Fix the bug" />
    );

    expect(screen.getByPlaceholderText("Commit summary")).toHaveValue(
      "Fix the bug"
    );
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toHaveValue("");
  });

  it("pre-fills summary and description from multi-line initialMessage", () => {
    render(
      <CommitMessageForm
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

  it("starts with empty fields when no initialMessage is provided", () => {
    render(<CommitMessageForm {...defaultProps} />);

    expect(screen.getByPlaceholderText("Commit summary")).toHaveValue("");
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toHaveValue("");
  });

  // ── Focus ──────────────────────────────────────────────────

  it("focuses the summary input on mount", () => {
    render(<CommitMessageForm {...defaultProps} />);

    expect(screen.getByPlaceholderText("Commit summary")).toHaveFocus();
  });

  // ── Submit ─────────────────────────────────────────────────

  it("calls onSubmit with combined message on submit button click", async () => {
    const user = userEvent.setup();

    render(<CommitMessageForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Commit summary"), "Summary");
    await user.type(
      screen.getByPlaceholderText("Extended description (optional)"),
      "Body text"
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith("Summary\n\nBody text");
  });

  it("calls onSubmit with summary only when description is empty", async () => {
    const user = userEvent.setup();

    render(<CommitMessageForm {...defaultProps} />);

    await user.type(screen.getByPlaceholderText("Commit summary"), "Summary");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith("Summary");
  });

  it("disables submit button when summary is empty", () => {
    render(<CommitMessageForm {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("disables submit button when isSubmitting is true", () => {
    render(
      <CommitMessageForm
        {...defaultProps}
        initialMessage="Summary"
        isSubmitting
      />
    );

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("disables inputs when isSubmitting is true", () => {
    render(
      <CommitMessageForm
        {...defaultProps}
        initialMessage="Summary"
        isSubmitting
      />
    );

    expect(screen.getByPlaceholderText("Commit summary")).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Extended description (optional)")
    ).toBeDisabled();
  });

  // ── Cancel ─────────────────────────────────────────────────

  it("calls onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();

    render(<CommitMessageForm {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup();

    render(<CommitMessageForm {...defaultProps} />);

    await user.keyboard("{Escape}");

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  // ── Error ──────────────────────────────────────────────────

  it("displays error message when provided", () => {
    render(
      <CommitMessageForm {...defaultProps} error="Something went wrong" />
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render error element when error is null", () => {
    render(<CommitMessageForm {...defaultProps} error={null} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
