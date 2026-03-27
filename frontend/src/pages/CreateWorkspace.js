import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import "../styles/createWorkspace.css";

function CreateWorkspace() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [github, setGithub] = useState("");

  const navigate = useNavigate();

  const selectFolder = async () => {
    const path = await window.api.selectFolder();
    if (path) setLocation(path);
  };

  const createWorkspace = async () => {
    if (!name || !location) {
      alert("Name and location required");
      return;
    }

    const workspace = await window.api.createWorkspace({
      name,
      location,
      github,
    });

    localStorage.setItem("lastWorkspace", JSON.stringify(workspace));

    navigate("/workspace", { state: workspace });
  };

  return (
    <div className="create-container">
      <div className="create-card">
        <h2 className="create-title">Create Workspace</h2>
        <p className="create-subtitle">
          Set up a new development workspace
        </p>

        {/* Name */}
        <div className="input-group">
          <label>Workspace Name</label>
          <input
            type="text"
            placeholder="My Project"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Location */}
        <div className="input-group">
          <label>Location</label>
          <div className="folder-select">
            <Button onClick={selectFolder}>
              Select Folder
            </Button>
            <span className="folder-path">
              {location || "No folder selected"}
            </span>
          </div>
        </div>

        {/* GitHub */}
        <div className="input-group">
          <label>GitHub Repo (optional)</label>
          <input
            type="text"
            placeholder="https://github.com/user/repo"
            value={github}
            onChange={(e) => setGithub(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="create-actions">
          <Button onClick={createWorkspace}>
            Create Workspace
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate("/")}
          >
            ← Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CreateWorkspace;
