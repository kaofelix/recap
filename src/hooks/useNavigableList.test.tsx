import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commandEmitter } from "../commands";
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

describe("useNavigableList", () => {
  beforeEach(() => {
    useAppStore.setState({ focusedRegion: "sidebar" });
  });

  it("selects next item when navigation.selectNext is emitted", () => {
    const onSelect = vi.fn();

    render(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    act(() => {
      commandEmitter.emit("navigation.selectNext");
    });

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("clamps at end of list when selecting next", () => {
    const onSelect = vi.fn();

    render(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="c"
        />
      </FocusProvider>
    );

    act(() => {
      commandEmitter.emit("navigation.selectNext");
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects previous item when navigation.selectPrev is emitted", () => {
    const onSelect = vi.fn();

    render(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="b"
        />
      </FocusProvider>
    );

    act(() => {
      commandEmitter.emit("navigation.selectPrev");
    });

    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("clamps at start of list when selecting previous", () => {
    const onSelect = vi.fn();

    render(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    act(() => {
      commandEmitter.emit("navigation.selectPrev");
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onActivate when navigation.activate is emitted", () => {
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onActivate={onActivate}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    act(() => {
      commandEmitter.emit("navigation.activate");
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("returns clickable item props", () => {
    const onSelect = vi.fn();

    const { getByRole } = render(
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

    const { getByRole } = render(
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

    const { getByRole } = render(
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
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="a"
        />
      </FocusProvider>
    );

    const bButton = getByRole("option", { name: "b" });
    Object.defineProperty(bButton, "scrollIntoView", {
      value: scrollIntoView,
      writable: true,
    });

    rerender(
      <FocusProvider region="sidebar">
        <NavigableListTest
          itemIds={["a", "b", "c"]}
          onSelect={onSelect}
          selectedId="b"
        />
      </FocusProvider>
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });
});
