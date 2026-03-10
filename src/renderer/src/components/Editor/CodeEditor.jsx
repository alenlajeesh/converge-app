import React from 'react';
import Editor from '@monaco-editor/react';
import './Editor.css';

const CodeEditor = ({ file, code, onCodeChange }) => {
    if (!file) return <div className="empty-view">Select a file to begin</div>;

    return (
        <div className="editor-container">
            <div className="editor-tab">
                <span>{file.name}</span>
            </div>
            <div className="editor-frame">
                <Editor 
                    theme="vs-dark" 
                    path={file.path}
                    value={code} 
                    onChange={onCodeChange}
                    options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                    }}
                />
            </div>
        </div>
    );
};

export default CodeEditor;
