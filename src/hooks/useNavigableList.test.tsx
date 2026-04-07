import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FocusProvider } from "../context/FocusContext";
import { useAppStore } from "../store/appStore";
import { useNavigableList } from "./useNavigableList";

function NavigableListTest({
  itemIds,
  selectedId,
  onSelect,
  onActivate,
}: {
  itemIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: () => void;
}) {
  const { containerProps, getItemProps } = useNavigableList({
    itemIds,
    selectedId,
    onSelect,
    onActivate,
  });

  return (
    <div {...containerProps}>
      {itemIds.map((id) => (
        <button key={id} type="button" {...getItemProps(id)}>
          {id}
        </button>
      ))}
    </div>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<HotkeysProvider>{ui}</HotkeysProvider>);
}

describe("useNavigableList", () => {
  beforeEach(() => {
    useAppStore.setState({ focusedRegion: "sidebar", overlayOpen: false });
  });

  it("selects next item when ArrowDown is pressed", () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("selects next item when Ctrl+N is pressed", () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "n", ctrlKey: true });

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("clamps at end of list when selecting next", () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="c"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects previous item when ArrowUp is pressed", () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="b"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "ArrowUp" });

    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("selects previous item when Ctrl+P is pressed", () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="b"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "p", ctrlKey: true });

    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("clamps at start of list when selecting previous", () => {
    const onSelect = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "ArrowUp" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onActivate when Enter is pressed", () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onActivate={onActivate}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when overlayOpen is true", () => {
    const onSelect = vi.fn();

    useAppStore.setState({ overlayOpen: true });

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not navigate when region is not focused", () => {
    const onSelect = vi.fn();

    useAppStore.setState({ focusedRegion: "diff" });

    renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("returns clickable item props", () => {
    const onSelect = vi.fn();

    const { getByRole } = renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    fireEvent.click(getByRole("option", { name: "c" }));

    expect(onSelect).toHaveBeenCalledWith("c");
  });

  it("sets aria-selected on items based on selectedId", () => {
    const onSelect = vi.fn();

    const { getByRole } = renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="b"
        />
      </FocusProvider>
    );

    expect(getByRole("option", { name: "a" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(getByRole("option", { name: "b" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("sets listbox role on the container", () => {
    const onSelect = vi.fn();

    const { getByRole } = renderWithProviders(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    expect(getByRole("listbox")).toBeInTheDocument();
  });

  it("scrolls selected item into view when selectedId changes", () => {
    const onSelect = vi.fn();
    const scrollIntoView = vi.fn();

    const { rerender, getByRole } = render(
      <HotkeysProvider>
        <FocusProvider region="sidebar">
          <NavigableListTest
            itemIds={["a", "b", "c"]}
            onSelect={onSelect}
            selectedId="a"
          />
        </FocusProvider>
      </HotkeysProvider>
    );

    const bButton = getByRole("option", { name: "b" });
    Object.defineProperty(bButton, "scrollIntoView", {
      value: scrollIntoView,
      writable: true,
    });

    rerender(
      <HotkeysProvider>
        <FocusProvider region="sidebar">
          <NavigableListTest
            itemIds={["a", "b", "c"]}
            onSelect={onSelect}
            selectedId="b"
          />
        </FocusProvider>
      </HotkeysProvider>
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});
