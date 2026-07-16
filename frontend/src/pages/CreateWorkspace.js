import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/createWorkspace.css";
import * as api from "../api";
const apiUrl = process.env.REACT_APP_API_URL;

function CreateWorkspace({ mode = "create" }) {
  const [name,     setName]     = useState("");
  const [location, setLocation] = useState("");
  const [github,   setGithub]   = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [status,   setStatus]   = useState("");
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const selectFolder = async () => {
    const path = await api.selectFolder();
    if (path) setLocation(path);
  };

  const handleSubmit = async () => {
    setError("");
    setStatus("");

    if (!user)     { navigate("/auth"); return; }
    if (!location) { setError("Please select a local folder"); return; }
    if (mode === "create" && !name)     { setError("Workspace name required"); return; }
    if (mode === "join"   && !joinCode) { setError("Join code required"); return; }

    setLoading(true);

    try {
      // ── JOIN ──────────────────────────────
      // A join code only means anything on the server, so this path
      // genuinely has to wait on the backend — there's no local
      // shortcut here.
      if (mode === "join") {
        setStatus("Joining workspace...");

        const res = await fetch(`${apiUrl}/api/workspace/join`, {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  "Bearer " + token
          },
          body: JSON.stringify({ joinCode: joinCode.trim() })
        });

        const onlineWorkspace = await res.json();
        if (!res.ok || !onlineWorkspace._id) {
          setError(onlineWorkspace.message || "Invalid join code");
          return;
        }

        const repoUrl = onlineWorkspace.repoUrl || null;
        setStatus(
          repoUrl
            ? "Cloning repository... this may take a moment"
            : "Setting up local folder..."
        );

        const workspace = await api.createWorkspace({
          name:   onlineWorkspace.name,
          location,
          github: repoUrl
        });

        if (!workspace.success) {
          setError(workspace.error || "Local setup failed");
          return;
        }

        await api.saveWorkspaceId(workspace.path, onlineWorkspace._id);

        navigate(`/workspace/${onlineWorkspace._id}`, {
          state: {
            path:        workspace.path,
            repoPath:    workspace.repoPath,
            name:        workspace.name,
            workspaceId: onlineWorkspace._id,
            joinCode:    onlineWorkspace.joinCode,
            repoUrl
          }
        });

      // ── CREATE ────────────────────────────
      // Everything the local setup needs (name, folder, github url)
      // came straight from what you typed — no reason to wait on the
      // (possibly slow/sleeping) backend before doing it.
      } else {
        const repoUrl = github.trim() || null;

        setStatus(
          repoUrl
            ? "Cloning repository... this may take a moment"
            : "Setting up local folder..."
        );

        const workspace = await api.createWorkspace({ name, location, github: repoUrl });

        if (!workspace.success) {
          setError(workspace.error || "Local setup failed");
          return;
        }

        // 🚀 Open it right away — don't wait on the backend record.
        navigate(`/workspace/pending`, {
          state: {
            path:        workspace.path,
            repoPath:    workspace.repoPath,
            name:        workspace.name,
            workspaceId: null,
            repoUrl
          }
        });

        // 🌐 Create the backend record in the background. If the
        // server is slow or asleep, the workspace is already open and
        // usable locally — WorkspaceHome will pick up the real id
        // once this resolves (needed for join codes / chat / calls).
        fetch(`${apiUrl}/api/workspace/create`, {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  "Bearer " + token
          },
          body: JSON.stringify({ name, repoUrl, localPath: location })
        })
          .then((res) => res.json())
          .then((onlineWorkspace) => {
            if (onlineWorkspace?._id) {
              api.saveWorkspaceId(workspace.path, onlineWorkspace._id);
            }
          })
          .catch((err) => console.error("Background workspace create failed:", err));
      }

    } catch (err) {
      console.error(err);
      setError("Something went wrong setting up the workspace locally");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  return (
    <div className="create-container">
      <div className="create-card">
        <div className="create-header">
          <div>
            <h2 className="create-title">
              {mode === "join" ? "Join Workspace" : "New Workspace"}
            </h2>
            <p className="create-subtitle">
              {mode === "join"
                ? "Enter the invite code to join your team"
                : "Set up a new collaborative project"}
            </p>
          </div>
          <button className="create-back" onClick={() => navigate("/")}>
            ← Back
          </button>
        </div>

        {error  && <div className="create-error">{error}</div>}
        {status && <div className="create-status">⏳ {status}</div>}

        {mode === "create" && (
          <div className="input-group">
            <label>Workspace Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
            />
          </div>
        )}

        {mode === "join" && (
          <div className="input-group">
            <label>Invite Code</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.trim())}
              placeholder="e.g. aX9kP2"
            />
          </div>
        )}

        <div className="input-group">
          <label>Local Folder</label>
          <div className="folder-row">
            <button className="btn-folder" onClick={selectFolder}>
              📁 Browse
            </button>
            <span className="folder-path">
              {location || "No folder selected"}
            </span>
          </div>
        </div>

        {mode === "create" && (
          <div className="input-group">
            <label>
              GitHub URL <span className="optional">(optional)</span>
            </label>
            <input
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/user/repo"
            />
          </div>
        )}

        <div className="create-actions">
          <button
            className="btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "join" ? "Join Workspace" : "Create Workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkspace;