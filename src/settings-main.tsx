import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsPage } from "./components/Settings/SettingsPage";
import { setupTheme } from "./hooks/useTheme";
import "./index.css";

setupTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);

// Show the window now that the content is ready to render.
// The window is created hidden to avoid a white flash.
getCurrentWindow().show();
