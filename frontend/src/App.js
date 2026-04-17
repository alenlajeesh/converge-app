import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CreateWorkspace from "./pages/CreateWorkspace";
import WorkspaceHome from "./pages/WorkspaceHome";
import { AuthProvider } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage"
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create" element={<CreateWorkspace />} />
		  <Route path="/join" element={<CreateWorkspace mode="join" />} />
          <Route path="/workspace/:id" element={<WorkspaceHome />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
export default App;
