import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupTheme } from "./hooks/useTheme";
import "./index.css";
import { setupGlobalErrorBridge } from "./lib/errorBridge";

setupGlobalErrorBridge();
setupTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
