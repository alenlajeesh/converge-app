import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";
import * as api from "../api";

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    const data = await api.getWorkspaces();
    setWorkspaces(data || []);
  };

  // 🚀 Opens instantly using local data only. No backend round-trip,
  // no login requirement — the workspace itself is entirely local.
  // If you're logged in, WorkspaceHome links/refreshes the backend
  // record for you in the background (for join codes, chat, etc.)
  // without blocking anything here.
  const openWorkspace = (ws) => {
    navigate(`/workspace/${ws.workspaceId || "pending"}`, {
      state: {
        path:        ws.path,
        repoPath:    ws.repoPath || ws.path,
        name:        ws.name,
        workspaceId: ws.workspaceId || null
      }
    });
  };

  const openExisting = async () => {
    try {
      setLoading(true);

      // Native folder dialog + local workspace.json read — no network.
      const res = await api.openWorkspaceFolder();
      if (!res || !res.success) {
        if (res?.error) alert(res.error);
        return;
      }

      await loadWorkspaces();

      navigate(`/workspace/pending`, {
        state: {
          path:        res.path,
          repoPath:    res.repoPath || res.path,
          name:        res.name,
          workspaceId: null
        }
      });
    } catch (err) {
      console.error(err);
      alert("Something went wrong opening the folder");
    } finally {
      setLoading(false);
    }
  };

  const removeWorkspace = async (e, ws) => {
    e.stopPropagation();
    await api.removeWorkspace(ws.path);
    loadWorkspaces();
  };

  return (
    <div className="dashboard">
      <div className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="dashboard-brand-icon">⬡</span>
          <span className="dashboard-brand-name">Converge</span>
        </div>
        <div className="dashboard-topbar-right">
          {!user ? (
            <button className="btn btn-primary" onClick={() => navigate("/auth")}>
              Login
            </button>
          ) : (
            <>
              <div className="dashboard-user">
                <span className="dashboard-user-avatar">
                  {user.username?.[0]?.toUpperCase()}
                </span>
                <span>{user.username}</span>
              </div>
              <button className="btn btn-ghost" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-body">
        <div className="dashboard-left">
          <h1 className="dashboard-heading">Your Workspaces</h1>
          <p className="dashboard-sub">
            Open a project or create a new collaborative workspace
          </p>
          <div className="dashboard-actions">
            <button className="btn btn-primary" onClick={() => navigate("/create")}>
              <span>+</span> New Workspace
            </button>
            <button
              className="btn btn-secondary"
              onClick={openExisting}
              disabled={loading}
            >
              📂 Open Existing
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/join")}
            >
              🔗 Join Workspace
            </button>
          </div>
        </div>

        <div className="dashboard-right">
          {workspaces.length === 0 ? (
            <div className="workspace-empty">
              <p>No workspaces yet.</p>
              <span>Create or open one to get started.</span>
            </div>
          ) : (
            <div className="workspace-list">
              {workspaces.map((ws, i) => (
                <div
                  key={i}
                  className="workspace-item"
                  onClick={() => openWorkspace(ws)}
                >
                  <div className="workspace-item-icon">
                    {ws.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="workspace-item-info">
                    <strong>{ws.name}</strong>
                    <span>{ws.path}</span>
                  </div>
                  <button
                    className="workspace-item-remove"
                    onClick={(e) => removeWorkspace(e, ws)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;