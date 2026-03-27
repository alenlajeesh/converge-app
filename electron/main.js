const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");

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

app.whenReady().then(() => {
  console.log("🚀 Electron Ready");

  exec("git --version", (err, stdout) => {
    console.log("🔍 Git:", stdout || err);
  });

  createWindow();
});

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


// 📁 Global workspace storage
const getStorePath = () => {
  return path.join(app.getPath("userData"), "workspaces.json");
};

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
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath));
});


// 🏗️ CREATE WORKSPACE (🔥 WITH CLONE)
ipcMain.handle("create-workspace", async (event, data) => {
  const { name, location, github } = data;

  const workspacePath = path.join(location, name);

  try {
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath);
    }

    const config = {
      name,
      github: github || null,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(workspacePath, "workspace.json"),
      JSON.stringify(config, null, 2)
    );

    // 🔥 Normalize repo URL
    const normalizeRepoUrl = (url) => {
      if (!url) return null;
      if (url.startsWith("git@github.com:")) {
        return url.replace("git@github.com:", "https://github.com/");
      }
      return url;
    };

    let repoPath = workspacePath;
    const repoUrl = normalizeRepoUrl(github);

    // 🚀 CLONE DURING CREATION
    if (repoUrl) {
      const repoName = repoUrl.split("/").pop().replace(".git", "");
      repoPath = path.join(workspacePath, repoName);

      if (!fs.existsSync(repoPath)) {
        console.log("⬇️ Cloning repo during creation...");

        await new Promise((resolve, reject) => {
          const git = spawn("git", ["clone", repoUrl], {
            cwd: workspacePath,
          });

          git.stdout.on("data", (d) => console.log("📤", d.toString()));
          git.stderr.on("data", (d) => console.log("⚠️", d.toString()));

          git.on("error", (err) => {
            console.log("❌ Spawn error:", err);
            reject(err.message);
          });

          git.on("close", (code) => {
            console.log("🔚 Git exited:", code);
            if (code === 0) resolve();
            else reject("Clone failed");
          });
        });

        console.log("✅ Clone complete");
      }
    }

    const newWorkspace = {
      name,
      path: workspacePath,
      repoPath, // 🔥 IMPORTANT
    };

    saveWorkspaceToList(newWorkspace);

    return {
      success: true,
      ...newWorkspace,
    };

  } catch (err) {
    console.error("❌ Create workspace failed:", err);
    return {
      success: false,
      error: err.message,
    };
  }
});


// 📂 OPEN WORKSPACE (NO CLONE)
ipcMain.handle("open-workspace-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled) return null;

  const folderPath = result.filePaths[0];
  const configPath = path.join(folderPath, "workspace.json");

  if (!fs.existsSync(configPath)) {
    return {
      success: false,
      error: "No workspace.json found",
    };
  }

  const config = JSON.parse(fs.readFileSync(configPath));

  let repoPath = folderPath;

  if (config.github) {
    const repoName = config.github.split("/").pop().replace(".git", "");
    repoPath = path.join(folderPath, repoName);
  }

  const workspace = {
    name: config.name || path.basename(folderPath),
    path: folderPath,
    repoPath,
  };

  saveWorkspaceToList(workspace);

  return {
    success: true,
    ...workspace,
  };
});


// ❌ Remove workspace
ipcMain.handle("remove-workspace", async (event, workspacePath) => {
  const filePath = getStorePath();

  if (!fs.existsSync(filePath)) return { success: true };

  let workspaces = JSON.parse(fs.readFileSync(filePath));
  workspaces = workspaces.filter((w) => w.path !== workspacePath);

  fs.writeFileSync(filePath, JSON.stringify(workspaces, null, 2));

  return { success: true };
});


// 📂 File system ops
ipcMain.handle("read-dir", async (event, dirPath) => {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  return items.map((item) => ({
    name: item.name,
    path: path.join(dirPath, item.name),
    isDir: item.isDirectory(),
  }));
});

ipcMain.handle("read-file", async (event, filePath) => {
  return fs.readFileSync(filePath, "utf-8");
});

ipcMain.handle("write-file", async (event, filePath, content) => {
  fs.writeFileSync(filePath, content);
  return true;
});

ipcMain.handle("create-file", async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    return { success: false, error: "Already exists" };
  }
  fs.writeFileSync(filePath, "");
  return { success: true };
});

ipcMain.handle("create-folder", async (event, dirPath) => {
  if (fs.existsSync(dirPath)) {
    return { success: false, error: "Already exists" };
  }
  fs.mkdirSync(dirPath);
  return { success: true };
});

ipcMain.handle("delete-path", async (event, targetPath) => {
  if (fs.lstatSync(targetPath).isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
  return true;
});

ipcMain.handle("rename-path", async (event, oldPath, newPath) => {
  if (fs.existsSync(newPath)) {
    return { success: false, error: "Already exists" };
  }
  fs.renameSync(oldPath, newPath);
  return { success: true };
});

ipcMain.handle("run-command", async (event, command, cwd) => {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) return resolve(stderr || error.message);
      resolve(stdout || "Done");
    });
  });
});
