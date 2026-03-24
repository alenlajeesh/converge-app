const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("http://localhost:3000");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});


// 📂 Select Folder
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled) return null;

  return result.filePaths[0];
});


// 📁 Global workspace storage path
const getStorePath = () => {
  return path.join(app.getPath("userData"), "workspaces.json");
};


// 💾 Save workspace to global list
const saveWorkspaceToList = (workspace) => {
  const filePath = getStorePath();

  let workspaces = [];

  if (fs.existsSync(filePath)) {
    workspaces = JSON.parse(fs.readFileSync(filePath));
  }

  const exists = workspaces.find((w) => w.path === workspace.path);

  if (!exists) {
    workspaces.push(workspace);
    fs.writeFileSync(filePath, JSON.stringify(workspaces, null, 2));
  }
};


// 📥 Get all workspaces
ipcMain.handle("get-workspaces", async () => {
  const filePath = getStorePath();

  if (!fs.existsSync(filePath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(filePath));
});


// 🏗️ Create Workspace
ipcMain.handle("create-workspace", async (event, data) => {
  const { name, location, github } = data;

  const workspacePath = path.join(location, name);

  try {
    // Create folder
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath);
    }

    // Create config file
    const config = {
      name,
      github: github || null,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(workspacePath, "workspace.json"),
      JSON.stringify(config, null, 2)
    );

    const newWorkspace = {
      name,
      path: workspacePath,
    };

    // 🔥 Save globally
    saveWorkspaceToList(newWorkspace);

    return {
      success: true,
      ...newWorkspace,
    };

  } catch (err) {
    console.error(err);

    return {
      success: false,
      error: err.message,
    };
  }
});


// 📂 Open Existing Workspace
ipcMain.handle("open-workspace-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled) return null;

  const folderPath = result.filePaths[0];
  const configPath = path.join(folderPath, "workspace.json");

  // ❌ Not a valid workspace
  if (!fs.existsSync(configPath)) {
    return {
      success: false,
      error: "No workspace.json found in this folder",
    };
  }

  // ✅ Read config
  const config = JSON.parse(fs.readFileSync(configPath));

  const workspace = {
    name: config.name || path.basename(folderPath),
    path: folderPath,
  };

  // Save if not already present
  saveWorkspaceToList(workspace);

  return {
    success: true,
    ...workspace,
  };
});

// ❌ Remove workspace from list
ipcMain.handle("remove-workspace", async (event, workspacePath) => {
  const filePath = getStorePath();

  if (!fs.existsSync(filePath)) return { success: true };

  let workspaces = JSON.parse(fs.readFileSync(filePath));

  // Filter out the workspace
  workspaces = workspaces.filter((w) => w.path !== workspacePath);

  fs.writeFileSync(filePath, JSON.stringify(workspaces, null, 2));

  return { success: true };
});


// 📂 Read directory
ipcMain.handle("read-dir", async (event, dirPath) => {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  return items.map((item) => ({
    name: item.name,
    path: path.join(dirPath, item.name),
    isDir: item.isDirectory(),
  }));
});

// 📄 Read file
ipcMain.handle("read-file", async (event, filePath) => {
  return fs.readFileSync(filePath, "utf-8");
});

// 💾 Write file
ipcMain.handle("write-file", async (event, filePath, content) => {
  fs.writeFileSync(filePath, content);
  return true;
});

ipcMain.handle("create-file", async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return {
        success: false,
        error: "File or folder already exists",
      };
    }

    fs.writeFileSync(filePath, "");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});

ipcMain.handle("create-folder", async (event, dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      return {
        success: false,
        error: "File or folder already exists",
      };
    }

    fs.mkdirSync(dirPath);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});

// ❌ Delete
ipcMain.handle("delete-path", async (event, targetPath) => {
  if (fs.lstatSync(targetPath).isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
  return true;
});

ipcMain.handle("rename-path", async (event, oldPath, newPath) => {
  try {
    if (fs.existsSync(newPath)) {
      return {
        success: false,
        error: "File or folder with this name already exists",
      };
    }

    fs.renameSync(oldPath, newPath);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
});
