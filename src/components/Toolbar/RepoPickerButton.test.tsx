import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../store/appStore";
import { render, screen, userEvent } from "../../test/utils";
import { RepoPickerButton } from "./RepoPickerButton";

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

    expect(
      screen.getByRole("button", { name: /select repository/i })
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole("menuitem", { name: /repo-one/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /repo-two/i })
    ).toBeInTheDocument();
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

    // repo-one should not have a checkmark (but will have trash icon)
    const repoOneItem = screen.getByRole("menuitem", { name: /repo-one/i });
    // eslint-disable-next-line testing-library/no-node-access
    const repoOneCheckmark = repoOneItem.querySelector(
      "span.flex.h-4.w-4 > svg"
    );
    expect(repoOneCheckmark).not.toBeInTheDocument();
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

  describe("remove repo", () => {
    it("should show delete button when hovering a repo item", async () => {
      const user = userEvent.setup();

      act(() => {
        useAppStore.getState().addRepo("/path/to/my-repo");
      });

      render(<RepoPickerButton />);

      // Open dropdown
      await user.click(
        screen.getByRole("button", { name: /select repository/i })
      );

      const deleteButton = screen.getByRole("button", {
        name: /remove my-repo/i,
      });

      // Delete button should be hidden initially (opacity-0)
      expect(deleteButton).toHaveClass("opacity-0");

      // Hover over the repo item
      const repoItem = screen.getByRole("menuitem", { name: /my-repo/i });
      await user.hover(repoItem);

      // Delete button should now be visible (group-hover:opacity-100)
      // Note: CSS hover states don't work in jsdom, but button is always in DOM
      expect(deleteButton).toBeInTheDocument();
    });

    it("should show confirmation dialog when clicking delete button", async () => {
      const user = userEvent.setup();

      act(() => {
        useAppStore.getState().addRepo("/path/to/my-repo");
      });

      render(<RepoPickerButton />);

      // Open dropdown
      await user.click(
        screen.getByRole("button", { name: /select repository/i })
      );

      // Click delete button
      const deleteButton = screen.getByRole("button", {
        name: /remove my-repo/i,
      });
      await user.click(deleteButton);

      // Confirmation dialog should appear
      expect(
        screen.getByRole("alertdialog", { name: /remove repository/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/remove "my-repo"/i)).toBeInTheDocument();
    });

    it("should close dialog when clicking cancel", async () => {
      const user = userEvent.setup();

      act(() => {
        useAppStore.getState().addRepo("/path/to/my-repo");
      });

      render(<RepoPickerButton />);

      // Open dropdown and click delete
      await user.click(
        screen.getByRole("button", { name: /select repository/i })
      );
      await user.click(screen.getByRole("button", { name: /remove my-repo/i }));

      // Click cancel
      await user.click(screen.getByRole("button", { name: /cancel/i }));

      // Dialog should close, repo should still exist
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(useAppStore.getState().repos).toHaveLength(1);
    });

    it("should remove repo when clicking confirm", async () => {
      const user = userEvent.setup();

      act(() => {
        useAppStore.getState().addRepo("/path/to/my-repo");
      });

      render(<RepoPickerButton />);

      // Open dropdown and click delete
      await user.click(
        screen.getByRole("button", { name: /select repository/i })
      );
      await user.click(screen.getByRole("button", { name: /remove my-repo/i }));

      // Click remove/confirm
      await user.click(screen.getByRole("button", { name: /^remove$/i }));

      // Dialog should close, repo should be removed
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(useAppStore.getState().repos).toHaveLength(0);
    });

    it("should auto-select another repo when removing the selected one", async () => {
      const user = userEvent.setup();

      act(() => {
        useAppStore.getState().addRepo("/path/to/repo-one");
        useAppStore.getState().addRepo("/path/to/repo-two");
      });

      // repo-two is selected (last added)
      const repoOneId = useAppStore.getState().repos[0].id;

      render(<RepoPickerButton />);

      // Open dropdown and delete repo-two (the selected one)
      await user.click(
        screen.getByRole("button", { name: /select repository/i })
      );
      await user.click(
        screen.getByRole("button", { name: /remove repo-two/i })
      );
      await user.click(screen.getByRole("button", { name: /^remove$/i }));

      // Should auto-select repo-one
      expect(useAppStore.getState().selectedRepoId).toBe(repoOneId);
      expect(useAppStore.getState().repos).toHaveLength(1);
    });

    it("should hide picker when removing the last repo", async () => {
      const user = userEvent.setup();

      act(() => {
        useAppStore.getState().addRepo("/path/to/my-repo");
      });

      render(<RepoPickerButton />);

      // Open dropdown and delete the only repo
      await user.click(
        screen.getByRole("button", { name: /select repository/i })
      );
      await user.click(screen.getByRole("button", { name: /remove my-repo/i }));
      await user.click(screen.getByRole("button", { name: /^remove$/i }));

      // Picker should not be rendered (no repos)
      expect(
        screen.queryByRole("button", { name: /select repository/i })
      ).not.toBeInTheDocument();
      expect(useAppStore.getState().selectedRepoId).toBeNull();
    });
  });
});
