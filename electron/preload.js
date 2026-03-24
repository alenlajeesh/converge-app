const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Select folder (used in create workspace)
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  // Create workspace
  createWorkspace: (data) => ipcRenderer.invoke("create-workspace", data),

  // Get all saved workspaces
  getWorkspaces: () => ipcRenderer.invoke("get-workspaces"),

  // 🔥 Open existing workspace
  openWorkspaceFolder: () => ipcRenderer.invoke("open-workspace-folder"),

	removeWorkspace: (path) => ipcRenderer.invoke("remove-workspace", path),

	readDir: (dirPath) => ipcRenderer.invoke("read-dir", dirPath),
	readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
	writeFile: (filePath, content) =>
		ipcRenderer.invoke("write-file", filePath, content),
	createFile: (filePath) => ipcRenderer.invoke("create-file", filePath),
	createFolder: (dirPath) => ipcRenderer.invoke("create-folder", dirPath),
	deletePath: (targetPath) => ipcRenderer.invoke("delete-path", targetPath),
	renamePath: (oldPath, newPath) =>
		ipcRenderer.invoke("rename-path", oldPath, newPath),
});
