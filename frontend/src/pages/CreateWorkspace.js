import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";

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
    <div className="container">
      <div className="card">
        <h2>Create Workspace</h2>

        <input
          placeholder="Workspace Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div style={{ marginTop: "10px" }}>
          <Button onClick={selectFolder}>
            Select Location
          </Button>
          <p>{location}</p>
        </div>

        <input
          placeholder="GitHub Repo (optional)"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
        />

        <Button onClick={createWorkspace}>
          Create
        </Button>
		<Button variant="secondary" onClick={() => navigate("/")}>
			← Back
		</Button>
      </div>
    </div>
  );
}

export default CreateWorkspace;
