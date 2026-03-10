import React from 'react';
import FileTree from './FileTree';
import './Sidebar.css';

const Sidebar = ({ files, onFileClick, onOpenWorkspace }) => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <b>CONVERGE</b>
                <button className="icon-btn" onClick={onOpenWorkspace} title="Open Folder">+</button>
            </div>
            <div className="tree-viewport">
                {files.map(f => (
                    <FileTree key={f.path} item={f} onFileClick={onFileClick} />
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;
