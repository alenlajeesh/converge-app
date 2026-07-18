import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Dashboard       from "./pages/Dashboard";
import CreateWorkspace from "./pages/CreateWorkspace";
import WorkspaceHome   from "./pages/WorkspaceHome";
import AuthPage        from "./pages/AuthPage";
import MenuBar         from "./components/MenuBar";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <MenuBar />
          <Routes>
            <Route path="/"               element={<Dashboard />} />
            <Route path="/create"         element={<CreateWorkspace mode="create" />} />
            <Route path="/join"           element={<CreateWorkspace mode="join" />} />
            <Route path="/workspace/:id"  element={<WorkspaceHome />} />
            <Route path="/auth"           element={<AuthPage />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;