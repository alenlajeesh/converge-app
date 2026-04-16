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
    setWorkspaces(data || []);
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

  // 🔥 NEW JOIN FUNCTION
  const joinWorkspace = async () => {
    const joinCode = prompt("Enter join code");
    if (!joinCode) return;

    const username = "User_" + Date.now();

    try {
      const res = await fetch("http://localhost:5000/api/workspace/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ joinCode, username }),
      });

      const workspace = await res.json();

      if (!workspace._id) {
        alert("Invalid code");
        return;
      }

      const location = await window.api.selectFolder();
      if (!location) return;

      const local = await window.api.createWorkspace({
        name: workspace.name,
        location,
        github: workspace.repoUrl,
      });

      const finalWorkspace = {
        ...local,
        workspaceId: workspace._id,
        joinCode: workspace.joinCode,
      };

      navigate("/workspace", { state: finalWorkspace });

    } catch (err) {
      console.error(err);
      alert("Join failed");
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-card">
        <h1 className="dashboard-title">Workspaces</h1>

        <div className="dashboard-actions">
          <Button onClick={() => navigate("/create")}>
            Create Workspace
          </Button>

          <Button variant="secondary" onClick={openExisting}>
            Open Existing Workspace
          </Button>

          {/* 🔥 NEW BUTTON */}
          <Button variant="secondary" onClick={joinWorkspace}>
            Join Workspace
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
              <div>
                <strong>{ws.name}</strong>
                <p>{ws.path}</p>
              </div>

              <button
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
