import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store/appStore";
import { FocusProvider, useFocusRegion, useIsFocused } from "./FocusContext";

// Test component that displays focus region
function FocusRegionDisplay() {
  const region = useFocusRegion();
  return <div data-testid="region">{region ?? "none"}</div>;
}

// Test component that displays focus state
function FocusStateDisplay() {
  const isFocused = useIsFocused();
  return <div data-testid="focused">{isFocused ? "yes" : "no"}</div>;
}

describe("FocusContext", () => {
  beforeEach(() => {
    useAppStore.setState({ focusedRegion: null });
  });

  afterEach(() => {
    useAppStore.setState({ focusedRegion: null });
  });

  describe("useFocusRegion", () => {
    it("returns null when not in a FocusProvider", () => {
      render(<FocusRegionDisplay />);
      expect(screen.getByTestId("region")).toHaveTextContent("none");
    });

    it("returns the region from FocusProvider", () => {
      render(
        <FocusProvider region="sidebar">
          <FocusRegionDisplay />
        </FocusProvider>
      );
      expect(screen.getByTestId("region")).toHaveTextContent("sidebar");
    });
  });

  describe("useIsFocused", () => {
    it("returns false when region does not match focusedRegion", () => {
      useAppStore.setState({ focusedRegion: "files" });

      render(
        <FocusProvider region="sidebar">
          <FocusStateDisplay />
        </FocusProvider>
      );

      expect(screen.getByTestId("focused")).toHaveTextContent("no");
    });

    it("returns true when region matches focusedRegion", () => {
      useAppStore.setState({ focusedRegion: "sidebar" });

      render(
        <FocusProvider region="sidebar">
          <FocusStateDisplay />
        </FocusProvider>
      );

      expect(screen.getByTestId("focused")).toHaveTextContent("yes");
    });

    it("returns false when not in a FocusProvider", () => {
      useAppStore.setState({ focusedRegion: "sidebar" });

      render(<FocusStateDisplay />);

      expect(screen.getByTestId("focused")).toHaveTextContent("no");
    });
  });

  describe("click to focus", () => {
    it("sets focusedRegion when clicking inside FocusProvider", () => {
      render(
        <FocusProvider region="sidebar">
          <button type="button">Click me</button>
        </FocusProvider>
      );

      fireEvent.click(screen.getByText("Click me"));

      expect(useAppStore.getState().focusedRegion).toBe("sidebar");
    });

    it("updates focusedRegion when clicking different region", () => {
      useAppStore.setState({ focusedRegion: "sidebar" });

      render(
        <FocusProvider region="files">
          <button type="button">Click me</button>
        </FocusProvider>
      );

      fireEvent.click(screen.getByText("Click me"));

      expect(useAppStore.getState().focusedRegion).toBe("files");
    });
  });
});
