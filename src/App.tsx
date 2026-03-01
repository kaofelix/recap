import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppLayout } from "./components/Layout";
import { ContextMenuProvider } from "./context/ContextMenuContext";

function App() {
  return (
    <AppErrorBoundary>
      <ContextMenuProvider>
        <AppLayout />
      </ContextMenuProvider>
    </AppErrorBoundary>
  );
}

export default App;
