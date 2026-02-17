import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { useCommand } from "./useCommand";

interface UseNavigableListOptions {
  itemIds: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: () => void;
}

interface NavigableItemProps {
  "aria-selected": boolean;
  "data-item-id": string;
  onClick: () => void;
  role: "option";
}

interface UseNavigableListResult {
  containerProps: {
    ref: RefObject<HTMLDivElement | null>;
    role: "listbox";
  };
  getItemProps: (id: string) => NavigableItemProps;
}

export function useNavigableList({
  itemIds,
  selectedId,
  onSelect,
  onActivate,
}: UseNavigableListOptions): UseNavigableListResult {
  const containerRef = useRef<HTMLDivElement>(null);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    for (const [index, id] of itemIds.entries()) {
      map.set(id, index);
    }
    return map;
  }, [itemIds]);

  const selectNext = useCallback(() => {
    if (itemIds.length === 0) {
      return;
    }

    const currentIndex = selectedId ? (indexById.get(selectedId) ?? -1) : -1;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= 0 && nextIndex < itemIds.length) {
      onSelect(itemIds[nextIndex]);
    }
  }, [itemIds, selectedId, indexById, onSelect]);

  const selectPrev = useCallback(() => {
    if (itemIds.length === 0) {
      return;
    }

    const currentIndex = selectedId ? (indexById.get(selectedId) ?? -1) : -1;
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0 && prevIndex < itemIds.length) {
      onSelect(itemIds[prevIndex]);
    }
  }, [itemIds, selectedId, indexById, onSelect]);

  const handleActivate = useCallback(() => {
    if (onActivate) {
      onActivate();
    }
  }, [onActivate]);

  useCommand("navigation.selectNext", selectNext);
  useCommand("navigation.selectPrev", selectPrev);
  useCommand("navigation.activate", handleActivate);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const target = Array.from(
      container.querySelectorAll<HTMLElement>("[data-item-id]")
    ).find((element) => element.dataset.itemId === selectedId);

    target?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  const getItemProps = useCallback(
    (id: string): NavigableItemProps => ({
      "aria-selected": selectedId === id,
      "data-item-id": id,
      onClick: () => onSelect(id),
      role: "option",
    }),
    [onSelect, selectedId]
  );

  return {
    containerProps: {
      ref: containerRef,
      role: "listbox",
    },
    getItemProps,
  };
}
