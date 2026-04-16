import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import "../styles/createWorkspace.css";

function CreateWorkspace({ mode = "create" }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [github, setGithub] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const { user, token } = useAuth();
  const navigate = useNavigate();

  const selectFolder = async () => {
    const path = await window.api.selectFolder();
    if (path) setLocation(path);
  };

  const createWorkspace = async () => {
    if (!user) {
      alert("Login required");
      return;
    }

    if (!location) {
      alert("Select folder");
      return;
    }

    try {
      let onlineWorkspace;

      if (mode === "join") {
        // 🔥 JOIN EXISTING
        const res = await fetch("http://localhost:5000/api/workspace/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ joinCode }),
        });

        onlineWorkspace = await res.json();

        if (!onlineWorkspace._id) {
          alert("Invalid join code");
          return;
        }
      } else {
        // 🆕 CREATE NEW
        if (!name) {
          alert("Name required");
          return;
        }

        const res = await fetch("http://localhost:5000/api/workspace/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({
            name,
            repoUrl: github,
            localPath: location,
          }),
        });

        onlineWorkspace = await res.json();

        if (!onlineWorkspace._id) {
          alert("Failed to create workspace");
          return;
        }
      }

      // 💻 LOCAL SETUP
      const workspace = await window.api.createWorkspace({
        name: onlineWorkspace.name,
        location,
        github: onlineWorkspace.repoUrl,
      });

      if (!workspace.success) {
        alert(workspace.error);
        return;
      }

      const finalWorkspace = {
        ...workspace,
        workspaceId: onlineWorkspace._id,
        joinCode: onlineWorkspace.joinCode,
      };

      navigate(`/workspace/${onlineWorkspace._id}`, {
        state: finalWorkspace,
      });

    } catch (err) {
      console.error(err);
      alert("Failed");
    }
  };

  return (
    <div className="create-container">
      <div className="create-card">
        <h2 className="create-title">
          {mode === "join" ? "Join Workspace" : "Create Workspace"}
        </h2>

        {mode === "create" && (
          <div className="input-group">
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
            />
          </div>
        )}

        {mode === "join" && (
          <div className="input-group">
            <label>Join Code</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter join code"
            />
          </div>
        )}

        <div className="input-group">
          <label>Location</label>
          <Button onClick={selectFolder}>
            Select Folder
          </Button>
          <p>{location || "No folder selected"}</p>
        </div>

        {mode === "create" && (
          <div className="input-group">
            <label>GitHub URL</label>
            <input
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/user/repo"
            />
          </div>
        )}

        <div className="create-actions">
          <Button onClick={createWorkspace}>
            {mode === "join" ? "Join" : "Create"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate("/")}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkspace;
