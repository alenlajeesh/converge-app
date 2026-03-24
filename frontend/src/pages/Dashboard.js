import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import "../styles/dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);

  // 🔄 Load all workspaces
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    const data = await window.api.getWorkspaces();
    setWorkspaces(data);
  };

  // 📂 Open existing workspace
  const openExisting = async () => {
    const res = await window.api.openWorkspaceFolder();

    if (!res) return;

    if (!res.success) {
      alert(res.error);
      return;
    }

    navigate("/workspace", { state: res });
  };

  // ❌ Remove workspace from list
  const removeWorkspace = async (path) => {
    await window.api.removeWorkspace(path);
    loadWorkspaces(); // refresh UI
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Workspace Dashboard</h1>
        <p className="subtitle">
          Manage your workspaces
        </p>

        {/* Top Actions */}
        <div className="buttonContainer">
          <Button onClick={() => navigate("/create")}>
            Create Workspace
          </Button>

          <Button variant="secondary" onClick={openExisting}>
            Open Existing Workspace
          </Button>
        </div>

        {/* Workspace List */}
        <div style={{ marginTop: "25px" }}>
          {workspaces.length === 0 && (
            <p style={{ color: "#aaa" }}>
              No workspaces yet
            </p>
          )}

          {workspaces.map((ws, i) => (
            <div
              key={i}
              style={{
                padding: "12px",
                marginTop: "10px",
                background: "#2a2a3d",
                borderRadius: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "0.2s",
              }}
            >
              {/* Clickable workspace */}
              <div
                style={{
                  cursor: "pointer",
                  flex: 1,
                }}
                onClick={() =>
                  navigate("/workspace", { state: ws })
                }
              >
                <strong>{ws.name}</strong>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#aaa",
                    margin: "4px 0 0",
                  }}
                >
                  {ws.path}
                </p>
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeWorkspace(ws.path);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ff6b6b",
                  cursor: "pointer",
                  fontSize: "18px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  transition: "0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#3a1f1f";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
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
