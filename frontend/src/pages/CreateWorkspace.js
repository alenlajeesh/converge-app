import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/createWorkspace.css";

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
    const path = await window.api.selectFolder();
    if (path) setLocation(path);
  };

  const handleSubmit = async () => {
    setError("");
    setStatus("");

    if (!user) { navigate("/auth"); return; }
    if (!location) { setError("Please select a folder"); return; }
    if (mode === "create" && !name) { setError("Workspace name required"); return; }
    if (mode === "join"   && !joinCode) { setError("Join code required"); return; }

    setLoading(true);

    try {
      let onlineWorkspace;

      if (mode === "join") {
        setStatus("Joining workspace...");
        const res = await fetch("http://localhost:5000/api/workspace/join", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  "Bearer " + token
          },
          body: JSON.stringify({ joinCode })
        });

        onlineWorkspace = await res.json();
        if (!res.ok || !onlineWorkspace._id) {
          setError(onlineWorkspace.message || "Invalid join code");
          return;
        }
      } else {
        setStatus("Creating workspace...");
        const res = await fetch("http://localhost:5000/api/workspace/create", {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  "Bearer " + token
          },
          body: JSON.stringify({
            name,
            repoUrl:   github || null,
            localPath: location
          })
        });

        onlineWorkspace = await res.json();
        if (!res.ok || !onlineWorkspace._id) {
          setError(onlineWorkspace.message || "Failed to create workspace");
          return;
        }
      }

      // LOCAL SETUP
      setStatus(github ? "Cloning repository..." : "Setting up local folder...");

      const workspace = await window.api.createWorkspace({
        name:     onlineWorkspace.name,
        location,
        github:   onlineWorkspace.repoUrl || null
      });

      if (!workspace.success) {
        setError(workspace.error || "Local setup failed");
        return;
      }

      navigate(`/workspace/${onlineWorkspace._id}`, {
        state: {
          ...workspace,
          workspaceId: onlineWorkspace._id,
          joinCode:    onlineWorkspace.joinCode
        }
      });

    } catch (err) {
      console.error(err);
      setError("Server error. Is the backend running?");
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
          <button className="create-back" onClick={() => navigate("/")}>← Back</button>
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
            <label>GitHub URL <span className="optional">(optional)</span></label>
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
