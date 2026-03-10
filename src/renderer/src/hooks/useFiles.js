import { useState } from 'react';

export const useFiles = () => {
    const [rootFiles, setRootFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [code, setCode] = useState('');
    const [workspacePath, setWorkspacePath] = useState('');

    const openWorkspace = async () => {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            setWorkspacePath(path);
            const files = await window.electronAPI.getFiles(path);
            setRootFiles(files);
        }
    };

    const selectFile = async (file) => {
        const content = await window.electronAPI.readFile(file.path);
        setActiveFile(file);
        setCode(content);
    };

    const saveFile = async (currentCode) => {
        if (activeFile) {
            await window.electronAPI.saveFile({ 
                path: activeFile.path, 
                content: currentCode 
            });
        }
    };

    return { 
        rootFiles, 
        activeFile, 
        code, 
        setCode, 
        openWorkspace, 
        selectFile, 
        saveFile, 
        workspacePath 
    };
};
