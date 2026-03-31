import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppLayout } from "./components/Layout";
import { Toaster } from "./components/Toaster";
import { ContextMenuProvider } from "./context/ContextMenuContext";

function App() {
  return (
    <AppErrorBoundary>
      <ContextMenuProvider>
        <AppLayout />
        <Toaster />
      </ContextMenuProvider>
    </AppErrorBoundary>
  );
}

export default App;
