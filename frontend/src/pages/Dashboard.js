import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import "../styles/dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    const data = await window.api.getWorkspaces();
    setWorkspaces(data);
  };

  const openExisting = async () => {
    const res = await window.api.openWorkspaceFolder();
    if (!res) return;

    if (!res.success) {
      alert(res.error);
      return;
    }

    navigate("/workspace", { state: res });
  };

  const removeWorkspace = async (path) => {
    await window.api.removeWorkspace(path);
    loadWorkspaces();
  };

  return (
    <div className="dashboard">
      <div className="dashboard-card">
        <h1 className="dashboard-title">Workspace Dashboard</h1>
        <p className="dashboard-subtitle">
          Manage your workspaces
        </p>

        <div className="dashboard-actions">
          <Button onClick={() => navigate("/create")}>
            Create Workspace
          </Button>

          <Button variant="secondary" onClick={openExisting}>
            Open Existing Workspace
          </Button>
        </div>

        <div className="workspace-list">
          {workspaces.length === 0 && (
            <p className="empty-text">No workspaces yet</p>
          )}

          {workspaces.map((ws, i) => (
            <div
              key={i}
              className="workspace-item"
              onClick={() =>
                navigate("/workspace", { state: ws })
              }
            >
              <div className="workspace-info">
                <strong>{ws.name}</strong>
                <p>{ws.path}</p>
              </div>

              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWorkspace(ws.path);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
