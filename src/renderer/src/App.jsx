import React, { useEffect } from 'react';
// Components
import Sidebar from './components/Sidebar/Sidebar';
import CodeEditor from './components/Editor/CodeEditor';
import TerminalView from './components/Terminal/Terminal';
import StatusBar from './components/Layout/StatusBar';
import Dashboard from './components/Dashboard/Dashboard';
// Hooks & Styles
import { useFiles } from './hooks/useFiles';
import './App.css';

/**
 * App Component
 * Acts as the main orchestrator for Converge.
 */
function App() {
    const { 
        rootFiles, 
        activeFile, 
        code, 
        setCode, 
        openWorkspace, 
        selectFile, 
        workspacePath, 
        saveFile 
    } = useFiles();

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+S or Cmd+S to Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (activeFile) {
                    saveFile(code);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [code, activeFile, saveFile]);

    /**
     * RENDER LOGIC: DASHBOARD
     * If no folder is selected, show the Welcome/Dashboard screen.
     */
    if (!workspacePath) {
        return (
            <Dashboard 
                onOpen={openWorkspace} 
                onCreate={() => console.log("Init Git Flow...")} 
                recentWorkspaces={[]} // We will connect this to MongoDB later
            />
        );
    }

    /**
     * RENDER LOGIC: IDE
     * Once a workspacePath exists, render the full editor suite.
     */
    return (
        <div className="app-shell">
            {/* The Main Work Area: Sidebar + (Editor/Terminal Split) */}
            <div className="main-work-area">
                <Sidebar 
                    files={rootFiles} 
                    onFileClick={selectFile} 
                    onOpenWorkspace={openWorkspace} 
                />

                <div className="editor-terminal-split">
                    {/* Top Section: Monaco Editor */}
                    <section className="editor-region">
                        <CodeEditor 
                            file={activeFile} 
                            code={code} 
                            onCodeChange={setCode} 
                        />
                    </section>

                    {/* Bottom Section: xterm.js Terminal */}
                    <section className="terminal-region">
                        <TerminalView />
                    </section>
                </div>
            </div>

            {/* Bottom Status Bar: Git Branch and File Info */}
            <StatusBar workspacePath={workspacePath} />
        </div>
    );
}

export default App;
