import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

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
    if (!res || !res.success) return;

    if (!user) {
      alert("Login required");
      return;
    }

    const linkRes = await fetch("http://localhost:5000/api/workspace/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        localPath: res.path,
        name: res.name,
      }),
    });

    const workspace = await linkRes.json();

    navigate(`/workspace/${workspace._id}`, {
      state: {
        ...res,
        workspaceId: workspace._id,
      },
    });
  };

  const joinWorkspace = () => navigate("/join");

  return (
    <div className="dashboard">

      {/* TOP BAR */}
      <div className="dashboard-topbar">
        <h2 className="dashboard-title-app">Workspace App</h2>

        <div>
          {!user ? (
            <>
              <button className="btn btn-secondary" onClick={() => navigate("/auth")}>
                Login
              </button>
            </>
          ) : (
            <>
              <span className="dashboard-user">👤 {user.username}</span>
              <button className="btn btn-secondary" onClick={logout}>
                Logout
              </button>
            </>
          )}
        </div>
      </div>

      {/* CARD */}
      <div className="dashboard-card">
        <h1 className="dashboard-title">Workspaces</h1>

        <div className="dashboard-actions">
          <button className="btn btn-primary" onClick={() => navigate("/create")}>
            Create Workspace
          </button>

          <button className="btn btn-secondary" onClick={openExisting}>
            Open Existing Workspace
          </button>

          <button className="btn btn-secondary" onClick={joinWorkspace}>
            Join Workspace
          </button>
        </div>

        <div className="workspace-list">
          {workspaces.map((ws, i) => (
            <div key={i} className="workspace-item">
              <div>
                <strong>{ws.name}</strong>
                <br />
                <span>{ws.path}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default Dashboard;
