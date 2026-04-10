import { Item, Portal, Trigger } from "@radix-ui/react-dropdown-menu";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store/appStore";
import { DropdownMenu, DropdownMenuContent } from "./DropdownMenu";

describe("DropdownMenu", () => {
  beforeEach(() => {
    useAppStore.setState({ overlayOpen: false });
  });

  it("sets overlayOpen to true when opened", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <Trigger asChild>
          <button type="button">Open</button>
        </Trigger>
        <Portal>
          <DropdownMenuContent>
            <Item onSelect={() => undefined}>Item</Item>
          </DropdownMenuContent>
        </Portal>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(true);
    });
  });

  it("sets overlayOpen to false when closed", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <Trigger asChild>
          <button type="button">Open</button>
        </Trigger>
        <Portal>
          <DropdownMenuContent>
            <Item onSelect={() => undefined}>Item</Item>
          </DropdownMenuContent>
        </Portal>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(true);
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(false);
    });
  });

  it("blurs trigger after close to prevent arrow key reopening", async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <Trigger asChild>
          <button type="button">Open</button>
        </Trigger>
        <Portal>
          <DropdownMenuContent>
            <Item onSelect={() => undefined}>Item</Item>
          </DropdownMenuContent>
        </Portal>
      </DropdownMenu>
    );

    const button = screen.getByRole("button", { name: "Open" });
    await user.click(button);
    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(true);
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(false);
    });

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.activeElement).not.toBe(button);
  });

  it("blurs the trigger when the menu is dismissed by clicking outside", async () => {
    const user = userEvent.setup();

    render(
      <>
        <DropdownMenu>
          <Trigger asChild>
            <button type="button">Open</button>
          </Trigger>
          <Portal>
            <DropdownMenuContent>
              <Item onSelect={() => undefined}>Item</Item>
            </DropdownMenuContent>
          </Portal>
        </DropdownMenu>
        <div data-testid="outside">Outside</div>
      </>
    );

    const button = screen.getByRole("button", { name: "Open" });
    await user.click(button);

    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(true);
    });

    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);

    await waitFor(() => {
      expect(useAppStore.getState().overlayOpen).toBe(false);
    });

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.activeElement).not.toBe(button);
  });

  it("forwards onOpenChange to caller", async () => {
    const user = userEvent.setup();
    let lastOpen: boolean | undefined;

    render(
      <DropdownMenu
        onOpenChange={(open) => {
          lastOpen = open;
        }}
      >
        <Trigger asChild>
          <button type="button">Open</button>
        </Trigger>
        <Portal>
          <DropdownMenuContent>
            <Item onSelect={() => undefined}>Item</Item>
          </DropdownMenuContent>
        </Portal>
      </DropdownMenu>
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => {
      expect(lastOpen).toBe(true);
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(lastOpen).toBe(false);
    });
  });

  it("forwards open prop for controlled mode", () => {
    render(
      <DropdownMenu open={false}>
        <Trigger asChild>
          <button type="button">Open</button>
        </Trigger>
        <Portal>
          <DropdownMenuContent>
            <Item onSelect={() => undefined}>Item</Item>
          </DropdownMenuContent>
        </Portal>
      </DropdownMenu>
    );

    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });
});
