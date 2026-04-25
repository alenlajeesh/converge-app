import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard.css";
import * as api from "../api";
function Dashboard() {
  const apiUrl = process.env.REACT_APP_API_URL;
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    const data = await api.getWorkspaces();
    setWorkspaces(data || []);
  };

  const openWorkspace = async (ws) => {
    if (!user) { navigate("/auth"); return; }

    try {
      setLoading(true);

      // ✅ Pass workspaceId if stored locally so linkWorkspace
      // fetches the exact document instead of searching by localPath
      const linkRes = await fetch(`${apiUrl}/api/workspace/link`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  "Bearer " + token
        },
        body: JSON.stringify({
          localPath:   ws.path,
          name:        ws.name,
          workspaceId: ws.workspaceId || null  // ✅ pass stored id
        })
      });

      const workspace = await linkRes.json();
      if (!workspace._id) { alert("Failed to open workspace"); return; }

      navigate(`/workspace/${workspace._id}`, {
        state: {
          path:        ws.path,
          repoPath:    ws.repoPath || ws.path,
          name:        ws.name,
          workspaceId: workspace._id,
          joinCode:    workspace.joinCode  // ✅ always from DB
        }
      });
    } catch (err) {
      console.error(err);
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  const openExisting = async () => {
    if (!user) { navigate("/auth"); return; }

    try {
      setLoading(true);
      const res = await api.openWorkspaceFolder();
      if (!res || !res.success) {
        if (res?.error) alert(res.error);
        return;
      }

      const linkRes = await fetch(`${apiUrl}/api/workspace/link`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  "Bearer " + token
        },
        body: JSON.stringify({
          localPath: res.path,
          name:      res.name
        })
      });

      const workspace = await linkRes.json();
      if (!workspace._id) { alert("Failed to link workspace"); return; }

      await loadWorkspaces();

      navigate(`/workspace/${workspace._id}`, {
        state: {
          path:        res.path,
          repoPath:    res.repoPath || res.path,
          name:        res.name,
          workspaceId: workspace._id,
          joinCode:    workspace.joinCode  // ✅ always from DB
        }
      });
    } catch (err) {
      console.error(err);
      alert("Server error");
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
