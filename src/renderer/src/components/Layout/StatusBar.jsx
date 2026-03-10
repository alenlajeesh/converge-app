import React, { useEffect, useState } from 'react';
import './Layout.css';

const StatusBar = ({ workspacePath }) => {
    const [gitInfo, setGitInfo] = useState(null);

    useEffect(() => {
        if (!workspacePath) return;
        const checkGit = async () => {
            const status = await window.electronAPI.getGitStatus(workspacePath);
            setGitInfo(status);
        };
        checkGit();
        const interval = setInterval(checkGit, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [workspacePath]);

    return (
        <div className="status-bar">
            <div className="status-item">
                {gitInfo ? ` ${gitInfo.branch}` : 'No Repo'}
            </div>
            {gitInfo?.modified > 0 && (
                <div className="status-item modified">
                    ● {gitInfo.modified} changes
                </div>
            )}
            <div className="status-item right">UTF-8</div>
        </div>
    );
};

export default StatusBar;
