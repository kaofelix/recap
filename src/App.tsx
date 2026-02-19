import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppLayout } from "./components/Layout";
import { UpdateNotification } from "./components/UpdateNotification";

function App() {
  return (
    <AppErrorBoundary>
      <AppLayout />
      <UpdateNotification />
    </AppErrorBoundary>
  );
}

export default App;
