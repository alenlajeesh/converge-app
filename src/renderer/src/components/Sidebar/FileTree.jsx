import React, { useState } from 'react';
import './Sidebar.css';

const FileTree = ({ item, onFileClick, depth = 0 }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState([]);

    const handleToggle = async (e) => {
        e.stopPropagation(); // Prevent parent folders from triggering when child clicked
        
        if (item.isDirectory) {
            if (!isOpen && children.length === 0) {
                const res = await window.electronAPI.getFiles(item.path);
                setChildren(res);
            }
            setIsOpen(!isOpen);
        } else {
            onFileClick(item);
        }
    };

    return (
        <div className="tree-node-wrapper">
            <div 
                className={`tree-node ${item.isDirectory ? 'dir' : 'file'}`} 
                onClick={handleToggle}
                style={{ paddingLeft: `${depth * 12 + 10}px` }}
            >
                <span className="icon">
                    {item.isDirectory ? (isOpen ? '▾ 📂' : '▸ 📁') : '📄'}
                </span>
                <span className="name">{item.name}</span>
            </div>
            
            {isOpen && children.length > 0 && (
                <div className="tree-children">
                    {children.map(child => (
                        <FileTree 
                            key={child.path} 
                            item={child} 
                            onFileClick={onFileClick} 
                            depth={depth + 1} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FileTree;
