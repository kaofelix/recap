import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppLayout } from "./components/Layout";

function App() {
  return (
    <AppErrorBoundary>
      <AppLayout />
    </AppErrorBoundary>
  );
}

export default App;
