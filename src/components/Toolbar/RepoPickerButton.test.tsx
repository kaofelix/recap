import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, userEvent } from "../../test/utils";
import { RepoPickerButton } from "./RepoPickerButton";
import { useAppStore } from "../../store/appStore";
import { act } from "@testing-library/react";

describe("RepoPickerButton", () => {
  beforeEach(() => {
    // Reset store state
    act(() => {
      useAppStore.getState().clearRepos();
    });
  });

  it("should not render when no repos exist", () => {
    render(<RepoPickerButton />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should render when repos exist", () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<RepoPickerButton />);

    expect(screen.getByRole("button", { name: /select repository/i })).toBeInTheDocument();
  });

  it("should display the selected repo name", () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<RepoPickerButton />);

    expect(screen.getByText("my-repo")).toBeInTheDocument();
  });

  it("should display 'Select repo' when no repo is selected", () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
      useAppStore.getState().selectRepo(null);
    });

    render(<RepoPickerButton />);

    expect(screen.getByText("Select repo")).toBeInTheDocument();
  });

  it("should open dropdown when clicked", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/repo-one");
      useAppStore.getState().addRepo("/path/to/repo-two");
    });

    render(<RepoPickerButton />);

    const button = screen.getByRole("button", { name: /select repository/i });
    await user.click(button);

    // Check that both repos appear in the dropdown
    expect(screen.getByRole("menuitem", { name: /repo-one/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /repo-two/i })).toBeInTheDocument();
  });

  it("should switch repo when a different one is selected", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/repo-one");
      useAppStore.getState().addRepo("/path/to/repo-two");
    });

    // repo-two is auto-selected (last added)
    const repoOneId = useAppStore.getState().repos[0].id;

    render(<RepoPickerButton />);

    // Open dropdown
    const button = screen.getByRole("button", { name: /select repository/i });
    await user.click(button);

    // Click on repo-one
    const repoOneItem = screen.getByRole("menuitem", { name: /repo-one/i });
    await user.click(repoOneItem);

    // Verify selection changed
    expect(useAppStore.getState().selectedRepoId).toBe(repoOneId);
  });

  it("should show checkmark on currently selected repo", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/repo-one");
      useAppStore.getState().addRepo("/path/to/repo-two");
    });

    render(<RepoPickerButton />);

    // Open dropdown
    const button = screen.getByRole("button", { name: /select repository/i });
    await user.click(button);

    // repo-two should have the checkmark (it was added last and auto-selected)
    const repoTwoItem = screen.getByRole("menuitem", { name: /repo-two/i });
    
    // The checkmark is an SVG inside the menuitem
    // eslint-disable-next-line testing-library/no-node-access
    const checkmark = repoTwoItem.querySelector("svg");
    expect(checkmark).toBeInTheDocument();

    // repo-one should not have a checkmark
    const repoOneItem = screen.getByRole("menuitem", { name: /repo-one/i });
    // eslint-disable-next-line testing-library/no-node-access
    const repoOneIcons = repoOneItem.querySelectorAll("svg");
    expect(repoOneIcons).toHaveLength(0);
  });

  it("should close dropdown after selecting a repo", async () => {
    const user = userEvent.setup();

    act(() => {
      useAppStore.getState().addRepo("/path/to/repo-one");
      useAppStore.getState().addRepo("/path/to/repo-two");
    });

    render(<RepoPickerButton />);

    // Open dropdown
    const button = screen.getByRole("button", { name: /select repository/i });
    await user.click(button);

    // Click on repo-one
    const repoOneItem = screen.getByRole("menuitem", { name: /repo-one/i });
    await user.click(repoOneItem);

    // Dropdown should be closed (menu items should not be in the document)
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("should apply custom className", () => {
    act(() => {
      useAppStore.getState().addRepo("/path/to/my-repo");
    });

    render(<RepoPickerButton className="custom-class" />);

    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });
});
