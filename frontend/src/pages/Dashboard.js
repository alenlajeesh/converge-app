import React from "react";
import Button from "../components/Button";
import "../styles/dashboard.css";

function Dashboard() {
  return (
    <div className="container">
      <div className="card">
        <h1 className="title">Workspace Dashboard</h1>
        <p className="subtitle">
          Create a new workspace or join an existing one
        </p>

        <div className="buttonContainer">
          <Button variant="primary">
            Create Workspace
          </Button>

          <Button variant="secondary">
            Join Workspace
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
