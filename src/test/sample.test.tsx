import { describe, it, expect, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { render, screen, userEvent } from "./utils";
import App from "../App";

describe("Sample Test - Verify Testing Setup", () => {
  it("renders the welcome message", () => {
    render(<App />);
    expect(
      screen.getByText("Welcome to Tauri + React")
    ).toBeInTheDocument();
  });

  it("has a greet button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /greet/i })).toBeInTheDocument();
  });

  it("calls Tauri invoke when greeting", async () => {
    const user = userEvent.setup();
    vi.mocked(invoke).mockResolvedValue("Hello, Test!");

    render(<App />);

    const input = screen.getByPlaceholderText("Enter a name...");
    const button = screen.getByRole("button", { name: /greet/i });

    await user.type(input, "Test");
    await user.click(button);

    expect(invoke).toHaveBeenCalledWith("greet", { name: "Test" });
    expect(await screen.findByText("Hello, Test!")).toBeInTheDocument();
  });
});

describe("Tauri Mocks", () => {
  it("invoke is mocked", () => {
    expect(vi.isMockFunction(invoke)).toBe(true);
  });
});
