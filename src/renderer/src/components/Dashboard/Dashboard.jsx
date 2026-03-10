import React from 'react';
import './Dashboard.css';

const Dashboard = ({ onOpen, onCreate, recentWorkspaces = [] }) => {
    return (
        <div className="dashboard-container">
            <div className="dashboard-card">
                <h1>CONVERGE</h1>
                <p>Collaborative IDE for Modern Teams</p>
                
                <div className="actions">
                    <button onClick={onOpen} className="btn-primary">Open Existing Project</button>
                    <button onClick={onCreate} className="btn-secondary">New Workspace (Git Init)</button>
                </div>

                <div className="recent">
                    <h3>Recent Workspaces</h3>
                    {recentWorkspaces.length > 0 ? (
                        recentWorkspaces.map(ws => (
                            <div key={ws.path} className="recent-item" onClick={() => onOpen(ws.path)}>
                                <span>{ws.name}</span>
                                <small>{ws.path}</small>
                            </div>
                        ))
                    ) : (
                        <p className="hint">No recent projects found.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
