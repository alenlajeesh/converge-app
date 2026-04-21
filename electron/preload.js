const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  selectFolder:        ()                        => ipcRenderer.invoke("select-folder"),
  createWorkspace:     (data)                    => ipcRenderer.invoke("create-workspace", data),
  getWorkspaces:       ()                        => ipcRenderer.invoke("get-workspaces"),
  openWorkspaceFolder: ()                        => ipcRenderer.invoke("open-workspace-folder"),
  removeWorkspace:     (path)                    => ipcRenderer.invoke("remove-workspace", path),
  saveWorkspaceId:     (localPath, workspaceId)  => ipcRenderer.invoke("save-workspace-id", localPath, workspaceId),
  readDir:             (dirPath)                 => ipcRenderer.invoke("read-dir", dirPath),
  readFile:            (filePath)                => ipcRenderer.invoke("read-file", filePath),
  writeFile:           (filePath, content)       => ipcRenderer.invoke("write-file", filePath, content),
  createFile:          (filePath)                => ipcRenderer.invoke("create-file", filePath),
  createFolder:        (dirPath)                 => ipcRenderer.invoke("create-folder", dirPath),
  deletePath:          (targetPath)              => ipcRenderer.invoke("delete-path", targetPath),
  renamePath:          (oldPath, newPath)        => ipcRenderer.invoke("rename-path", oldPath, newPath),
  runCommand:          (command, cwd)            => ipcRenderer.invoke("run-command", command, cwd),
});
