const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Dialogs
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
    
    // File System
    getFiles: (path) => ipcRenderer.invoke('fs:getFiles', path),
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    saveFile: (data) => ipcRenderer.invoke('fs:saveFile', data),
    
    // Git
    getGitStatus: (path) => ipcRenderer.invoke('git:getStatus', path),
    gitInit: (path) => ipcRenderer.invoke('git:init', path),

    // Terminal
    sendTerminalInput: (data) => ipcRenderer.send('terminal:input', data),
    onTerminalData: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('terminal:incomingData', subscription);
        return () => ipcRenderer.removeListener('terminal:incomingData', subscription);
    }
});
