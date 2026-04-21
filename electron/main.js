const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs   = require("fs");
const { exec, spawn } = require("child_process");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  mainWindow.loadURL("http://localhost:3000");
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  console.log("🚀 Electron Ready");
  exec("git --version", (err, stdout) => {
    console.log("🔍 Git:", err ? err.message : stdout.trim());
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

const ok  = (data = {})          => ({ success: true,  ...data });
const err = (message, extra = {}) => ({ success: false, error: message, ...extra });

// Validate a path is a non-empty string and doesn't contain null bytes
const validatePath = (p) => {
  if (!p || typeof p !== "string") return "Invalid path";
  if (p.includes("\0"))            return "Path contains invalid characters";
  return null;
};

// ─────────────────────────────────────────
// WORKSPACE STORE
// ─────────────────────────────────────────

const getStorePath = () =>
  path.join(app.getPath("userData"), "workspaces.json");

const readStore = () => {
  const fp = getStorePath();
  if (!fs.existsSync(fp)) return [];
  try { return JSON.parse(fs.readFileSync(fp, "utf-8")); }
  catch { return []; }
};

const writeStore = (data) =>
  fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2));

const saveWorkspaceToList = (workspace) => {
  const list   = readStore();
  const exists = list.find((w) => w.path === workspace.path);
  if (!exists) writeStore([...list, workspace]);
};

// ─────────────────────────────────────────
// SELECT FOLDER
// ─────────────────────────────────────────

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─────────────────────────────────────────
// GET WORKSPACES
// ─────────────────────────────────────────

ipcMain.handle("get-workspaces", async () => {
  return readStore();
});

// ─────────────────────────────────────────
// CREATE WORKSPACE
// ─────────────────────────────────────────

ipcMain.handle("create-workspace", async (_event, data) => {
  try {
    const { name, location, github } = data || {};

    if (!name?.trim())     return err("Workspace name is required");
    if (!location?.trim()) return err("Location is required");

    const invalid = validatePath(location);
    if (invalid) return err(invalid);

    const workspacePath = path.join(location, name.trim());

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    const config = {
      name:      name.trim(),
      github:    github || null,
      createdAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(workspacePath, "workspace.json"),
      JSON.stringify(config, null, 2)
    );

    // Normalize SSH → HTTPS
    const normalizeUrl = (url) => {
      if (!url) return null;
      if (url.startsWith("git@github.com:"))
        return url.replace("git@github.com:", "https://github.com/");
      return url;
    };

    let repoPath = workspacePath;
    const repoUrl = normalizeUrl(github);

    if (repoUrl) {
      const repoName = repoUrl.split("/").pop().replace(/\.git$/, "");
      repoPath = path.join(workspacePath, repoName);

      if (!fs.existsSync(repoPath)) {
        console.log("⬇️ Cloning:", repoUrl);

        await new Promise((resolve, reject) => {
          const git = spawn("git", ["clone", repoUrl], {
            cwd:   workspacePath,
            shell: false,
          });

          git.stdout.on("data", (d) => console.log("📤", d.toString().trim()));
          git.stderr.on("data", (d) => console.log("⚠️",  d.toString().trim()));
          git.on("error", (e)    => reject(e.message));
          git.on("close", (code) => {
            if (code === 0) resolve();
            else reject(`git clone exited with code ${code}`);
          });
        });

        console.log("✅ Clone complete");
      }
    }

    const workspace = { name: name.trim(), path: workspacePath, repoPath };
    saveWorkspaceToList(workspace);
    return ok(workspace);

  } catch (e) {
    console.error("❌ create-workspace:", e);
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// OPEN EXISTING WORKSPACE FOLDER
// ─────────────────────────────────────────

ipcMain.handle("open-workspace-folder", async () => {
  try {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled) return null;

    const folderPath = result.filePaths[0];
    const configPath = path.join(folderPath, "workspace.json");

    if (!fs.existsSync(configPath))
      return err("No workspace.json found in this folder");

    let config;
    try { config = JSON.parse(fs.readFileSync(configPath, "utf-8")); }
    catch { return err("workspace.json is corrupted"); }

    let repoPath = folderPath;

    if (config.github) {
      // ✅ Normalize SSH → HTTPS before extracting repo name
      let repoUrl = config.github;
      if (repoUrl.startsWith("git@github.com:"))
        repoUrl = repoUrl.replace("git@github.com:", "https://github.com/");

      const repoName  = repoUrl.split("/").pop().replace(/\.git$/, "");
      const candidate = path.join(folderPath, repoName);

      if (fs.existsSync(candidate)) {
        repoPath = candidate;
      } else {
        // ✅ Repo folder doesn't exist yet — clone it now
        console.log("⬇️ Repo missing, cloning:", repoUrl);
        await new Promise((resolve, reject) => {
          const git = spawn("git", ["clone", repoUrl], {
            cwd:   folderPath,
            shell: false
          });
          git.stdout.on("data", (d) => console.log("📤", d.toString().trim()));
          git.stderr.on("data", (d) => console.log("⚠️",  d.toString().trim()));
          git.on("error",  (e)    => reject(e.message));
          git.on("close",  (code) => {
            if (code === 0) resolve();
            else reject(`git clone failed with code ${code}`);
          });
        });
        repoPath = candidate;
      }
    }

    const workspace = {
      name: config.name || path.basename(folderPath),
      path: folderPath,
      repoPath
    };

    saveWorkspaceToList(workspace);
    return ok(workspace);

  } catch (e) {
    console.error("❌ open-workspace-folder:", e);
    return err(e.message);
  }
});
// ─────────────────────────────────────────
// REMOVE WORKSPACE FROM LIST
// ─────────────────────────────────────────

ipcMain.handle("remove-workspace", async (_event, workspacePath) => {
  try {
    const invalid = validatePath(workspacePath);
    if (invalid) return err(invalid);

    const list = readStore().filter((w) => w.path !== workspacePath);
    writeStore(list);
    return ok();
  } catch (e) {
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// FILE SYSTEM — READ DIR
// ─────────────────────────────────────────

ipcMain.handle("read-dir", async (_event, dirPath) => {
  try {
    const invalid = validatePath(dirPath);
    if (invalid) return [];

    if (!fs.existsSync(dirPath)) return [];

    const stat = fs.lstatSync(dirPath);
    if (!stat.isDirectory()) return [];

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    return items
      .filter((item) => !item.name.startsWith(".git"))
      .map((item) => ({
        name:  item.name,
        path:  path.join(dirPath, item.name),
        isDir: item.isDirectory(),
      }));
  } catch (e) {
    console.error("❌ read-dir:", e.message);
    return [];
  }
});

// ✅ Save workspaceId against a local path
// so Dashboard can pass it back to linkWorkspace
ipcMain.handle("save-workspace-id", async (_event, localPath, workspaceId) => {
  try {
    const list = readStore();
    const updated = list.map((w) =>
      w.path === localPath ? { ...w, workspaceId } : w
    );
    writeStore(updated);
    return ok();
  } catch (e) {
    console.error("❌ save-workspace-id:", e.message);
    return err(e.message);
  }
});
// ─────────────────────────────────────────
// FILE SYSTEM — READ FILE
// ─────────────────────────────────────────

ipcMain.handle("read-file", async (_event, filePath) => {
  try {
    const invalid = validatePath(filePath);
    if (invalid) return "";

    if (!fs.existsSync(filePath)) return "";

    const stat = fs.lstatSync(filePath);
    if (stat.isDirectory()) return "";

    // Skip very large files (>5MB)
    if (stat.size > 5 * 1024 * 1024)
      return "// File too large to display (> 5MB)";

    return fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    console.error("❌ read-file:", e.message);
    return "";
  }
});

// ─────────────────────────────────────────
// FILE SYSTEM — WRITE FILE
// ─────────────────────────────────────────

ipcMain.handle("write-file", async (_event, filePath, content) => {
  try {
    const invalid = validatePath(filePath);
    if (invalid) return err(invalid);

    if (typeof content !== "string") return err("Content must be a string");

    fs.writeFileSync(filePath, content, "utf-8");
    return ok();
  } catch (e) {
    console.error("❌ write-file:", e.message);
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// FILE SYSTEM — CREATE FILE
// ─────────────────────────────────────────

ipcMain.handle("create-file", async (_event, filePath) => {
  try {
    const invalid = validatePath(filePath);
    if (invalid) return err(invalid);

    if (fs.existsSync(filePath)) return err("Already exists");

    // Make sure parent directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "", "utf-8");
    return ok({ path: filePath });
  } catch (e) {
    console.error("❌ create-file:", e.message);
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// FILE SYSTEM — CREATE FOLDER
// ─────────────────────────────────────────

ipcMain.handle("create-folder", async (_event, dirPath) => {
  try {
    const invalid = validatePath(dirPath);
    if (invalid) return err(invalid);

    if (fs.existsSync(dirPath)) return err("Already exists");

    fs.mkdirSync(dirPath, { recursive: true });
    return ok({ path: dirPath });
  } catch (e) {
    console.error("❌ create-folder:", e.message);
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// FILE SYSTEM — DELETE PATH
// ─────────────────────────────────────────

ipcMain.handle("delete-path", async (_event, targetPath) => {
  try {
    const invalid = validatePath(targetPath);
    if (invalid) return err(invalid);

    if (!fs.existsSync(targetPath)) return err("Path does not exist");

    const stat = fs.lstatSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    return ok();
  } catch (e) {
    console.error("❌ delete-path:", e.message);
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// FILE SYSTEM — RENAME / MOVE
// ─────────────────────────────────────────

ipcMain.handle("rename-path", async (_event, oldPath, newPath) => {
  try {
    const i1 = validatePath(oldPath);
    const i2 = validatePath(newPath);
    if (i1) return err(i1);
    if (i2) return err(i2);

    if (!fs.existsSync(oldPath)) return err("Source does not exist");
    if (fs.existsSync(newPath))  return err("A file with that name already exists");

    fs.renameSync(oldPath, newPath);
    return ok({ newPath });
  } catch (e) {
    console.error("❌ rename-path:", e.message);
    return err(e.message);
  }
});

// ─────────────────────────────────────────
// RUN TERMINAL COMMAND
// ─────────────────────────────────────────

ipcMain.handle("run-command", async (_event, command, cwd) => {
  try {
    if (!command?.trim()) return err("No command provided");

    const invalid = validatePath(cwd);
    if (invalid) return "Error: " + invalid;

    if (!fs.existsSync(cwd)) return "Error: Working directory does not exist";

    return await new Promise((resolve) => {
      exec(
        command,
        { cwd, timeout: 30000, shell: true, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) return resolve(stderr || error.message);
          resolve(stdout || "Done");
        }
      );
    });
  } catch (e) {
    console.error("❌ run-command:", e.message);
    return "Error: " + e.message;
  }
});
