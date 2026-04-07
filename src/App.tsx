import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppLayout } from "./components/Layout";
import { Toaster } from "./components/Toaster";

function App() {
  return (
    <AppErrorBoundary>
      <HotkeysProvider>
        <AppLayout />
        <Toaster />
      </HotkeysProvider>
    </AppErrorBoundary>
  );
}

export default App;
