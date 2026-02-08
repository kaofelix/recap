import { describe, it, expect, vi } from "vitest";
import { render, screen, userEvent } from "./utils";
import { tauriMocks } from "./setup";
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
    tauriMocks.invoke.mockResolvedValue("Hello, Test!");

    render(<App />);

    const input = screen.getByPlaceholderText("Enter a name...");
    const button = screen.getByRole("button", { name: /greet/i });

    await user.type(input, "Test");
    await user.click(button);

    expect(tauriMocks.invoke).toHaveBeenCalledWith("greet", { name: "Test" });
    expect(await screen.findByText("Hello, Test!")).toBeInTheDocument();
  });
});

describe("Tauri Mocks", () => {
  it("invoke is mocked and callable", () => {
    expect(vi.isMockFunction(tauriMocks.invoke)).toBe(true);
  });
});
