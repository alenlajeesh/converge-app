import { invoke } from "@tauri-apps/api/core";

// ── Workspace store ───────────────────────
export const getWorkspaces   = () =>
  invoke("get_workspaces");

export const removeWorkspace = (path) =>
  invoke("remove_workspace", { path });

export const saveWorkspaceId = (localPath, workspaceId) =>
  invoke("save_workspace_id", { localPath, workspaceId });

// ── Workspace setup ───────────────────────
export const createWorkspace = ({ name, location, github }) =>
  invoke("create_workspace", {
    name,
    location,
    github: github || null
  });

export const openWorkspaceFolder = () =>
  invoke("open_workspace_folder");

export const selectFolder = () =>
  invoke("select_folder");

// ── File system ───────────────────────────

// ✅ isDir comes correctly from Rust via serde rename
export const readDir = (path) =>
  invoke("read_dir", { path });

export const readFile = (path) =>
  invoke("read_file", { path });

export const writeFile = (path, content) =>
  invoke("write_file", { path, content });

export const createFile = (path) =>
  invoke("create_file", { path });

export const createFolder = (path) =>
  invoke("create_folder", { path });

export const deletePath = (path) =>
  invoke("delete_path", { path });

export const renamePath = (oldPath, newPath) =>
  invoke("rename_path", { oldPath, newPath });

export const runCommand = (command, cwd) =>
  invoke("run_command", { command, cwd });
