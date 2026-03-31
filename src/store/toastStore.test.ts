import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useToastStore } from "./toastStore";

describe("toastStore", () => {
  afterEach(() => {
    act(() => {
      useToastStore.getState().clearToasts();
    });
  });

  describe("addToast", () => {
    it("should add a toast with the given message", () => {
      act(() => {
        useToastStore.getState().addToast({ message: "Something went wrong" });
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe("Something went wrong");
    });

    it("should assign a unique id to each toast", () => {
      act(() => {
        useToastStore.getState().addToast({ message: "Error 1" });
        useToastStore.getState().addToast({ message: "Error 2" });
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(2);
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it("should default type to error", () => {
      act(() => {
        useToastStore.getState().addToast({ message: "Oops" });
      });

      expect(useToastStore.getState().toasts[0].type).toBe("error");
    });

    it("should return the id of the created toast", () => {
      let id: string | undefined;
      act(() => {
        id = useToastStore.getState().addToast({ message: "test" });
      });

      expect(id).toBeDefined();
      expect(useToastStore.getState().toasts[0].id).toBe(id);
    });
  });

  describe("dismissToast", () => {
    it("should remove a toast by id", () => {
      act(() => {
        useToastStore.getState().addToast({ message: "Error 1" });
        useToastStore.getState().addToast({ message: "Error 2" });
      });

      const idToRemove = useToastStore.getState().toasts[0].id;

      act(() => {
        useToastStore.getState().dismissToast(idToRemove);
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe("Error 2");
    });

    it("should be a no-op for unknown ids", () => {
      act(() => {
        useToastStore.getState().addToast({ message: "Error 1" });
      });

      act(() => {
        useToastStore.getState().dismissToast("nonexistent");
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });
});
