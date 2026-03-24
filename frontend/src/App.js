import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CreateWorkspace from "./pages/CreateWorkspace";
import WorkspaceHome from "./pages/WorkspaceHome";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateWorkspace />} />
        <Route path="/workspace" element={<WorkspaceHome />} />
      </Routes>
    </Router>
  );
}

export default App;
