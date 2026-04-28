use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileItem {
    pub name:   String,
    pub path:   String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Workspace {
    pub name:      String,
    pub path:      String,
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "workspaceId", skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CreateWorkspaceResult {
    pub success:   bool,
    pub name:      Option<String>,
    pub path:      Option<String>,
    #[serde(rename = "repoPath")]
    pub repo_path: Option<String>,
    pub error:     Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpenWorkspaceResult {
    pub success:   bool,
    pub name:      Option<String>,
    pub path:      Option<String>,
    #[serde(rename = "repoPath")]
    pub repo_path: Option<String>,
    pub error:     Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpResult {
    pub success: bool,
    pub error:   Option<String>,
}

// ─────────────────────────────────────────
// STORE HELPERS
// ─────────────────────────────────────────

fn get_store_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap()
        .join("workspaces.json")
}

fn read_store(app: &tauri::AppHandle) -> Vec<Workspace> {
    let path = get_store_path(app);
    if !path.exists() { return vec![]; }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_)      => vec![],
    }
}

fn write_store(app: &tauri::AppHandle, workspaces: &Vec<Workspace>) {
    let path = get_store_path(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, serde_json::to_string_pretty(workspaces).unwrap());
}

fn save_workspace(app: &tauri::AppHandle, workspace: &Workspace) {
    let mut list = read_store(app);
    let exists   = list.iter().any(|w| w.path == workspace.path);
    if !exists {
        list.push(workspace.clone());
        write_store(app, &list);
    }
}

fn chrono_now() -> String {
    use chrono::Utc;
    Utc::now().to_rfc3339()
}

// ─────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────

#[tauri::command]
fn get_workspaces(app: tauri::AppHandle) -> Vec<Workspace> {
    read_store(&app)
}

#[tauri::command]
fn remove_workspace(app: tauri::AppHandle, path: String) -> OpResult {
    let mut list = read_store(&app);
    list.retain(|w| w.path != path);
    write_store(&app, &list);
    OpResult { success: true, error: None }
}

#[tauri::command]
fn save_workspace_id(
    app: tauri::AppHandle,
    local_path: String,
    workspace_id: String,
) -> OpResult {
    let mut list = read_store(&app);
    for w in list.iter_mut() {
        if w.path == local_path {
            w.workspace_id = Some(workspace_id.clone());
        }
    }
    write_store(&app, &list);
    OpResult { success: true, error: None }
}

#[tauri::command]
async fn create_workspace(
    app: tauri::AppHandle,
    name: String,
    location: String,
    github: Option<String>,
) -> CreateWorkspaceResult {
    let workspace_path = Path::new(&location).join(&name);

    if let Err(e) = fs::create_dir_all(&workspace_path) {
        return CreateWorkspaceResult {
            success: false, name: None, path: None,
            repo_path: None, error: Some(e.to_string()),
        };
    }

    let config = serde_json::json!({
        "name":      &name,
        "github":    &github,
        "createdAt": chrono_now()
    });
    let _ = fs::write(
        workspace_path.join("workspace.json"),
        serde_json::to_string_pretty(&config).unwrap(),
    );

    let repo_url = github.as_ref().map(|u| {
        if u.starts_with("git@github.com:") {
            u.replace("git@github.com:", "https://github.com/")
        } else {
            u.clone()
        }
    });

    let mut repo_path = workspace_path.clone();

    if let Some(ref url) = repo_url {
        let repo_name  = url.split('/').last().unwrap_or("repo").replace(".git", "");
        let clone_path = workspace_path.join(&repo_name);

        if !clone_path.exists() {
            println!("⬇️ Cloning: {}", url);
            let output = Command::new("git")
                .args(["clone", url])
                .current_dir(&workspace_path)
                .env_remove("LD_LIBRARY_PATH") 
                .output();

            match output {
                Ok(out) if out.status.success() => {
                    println!("✅ Clone complete");
                    repo_path = clone_path;
                }
                Ok(out) => {
                    let err_msg = String::from_utf8_lossy(&out.stderr).to_string();
                    return CreateWorkspaceResult {
                        success: false, name: None, path: None,
                        repo_path: None, error: Some(err_msg),
                    };
                }
                Err(e) => {
                    return CreateWorkspaceResult {
                        success: false, name: None, path: None,
                        repo_path: None, error: Some(e.to_string()),
                    };
                }
            }
        } else {
            repo_path = clone_path;
        }
    }

    let ws = Workspace {
        name:         name.clone(),
        path:         workspace_path.to_string_lossy().to_string(),
        repo_path:    repo_path.to_string_lossy().to_string(),
        workspace_id: None,
    };
    save_workspace(&app, &ws);

    CreateWorkspaceResult {
        success:   true,
        name:      Some(name),
        path:      Some(workspace_path.to_string_lossy().to_string()),
        repo_path: Some(repo_path.to_string_lossy().to_string()),
        error:     None,
    }
}

#[tauri::command]
async fn open_workspace_folder(app: tauri::AppHandle) -> OpenWorkspaceResult {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();

    let folder_path = match folder {
        Some(p) => p.to_string(),
        None    => return OpenWorkspaceResult {
            success: false, name: None, path: None,
            repo_path: None, error: None,
        },
    };

    let config_path = Path::new(&folder_path).join("workspace.json");
    if !config_path.exists() {
        return OpenWorkspaceResult {
            success: false, name: None, path: None,
            repo_path: None,
            error: Some("No workspace.json found in this folder".to_string()),
        };
    }

    let config_str = match fs::read_to_string(&config_path) {
        Ok(s)  => s,
        Err(e) => return OpenWorkspaceResult {
            success: false, name: None, path: None,
            repo_path: None, error: Some(e.to_string()),
        },
    };

    let config: serde_json::Value = match serde_json::from_str(&config_str) {
        Ok(v)  => v,
        Err(_) => return OpenWorkspaceResult {
            success: false, name: None, path: None,
            repo_path: None,
            error: Some("workspace.json is corrupted".to_string()),
        },
    };

    let name = config["name"]
        .as_str()
        .unwrap_or(
            Path::new(&folder_path)
                .file_name()
                .unwrap_or_default()
                .to_str()
                .unwrap_or("Workspace"),
        )
        .to_string();

    let mut repo_path = folder_path.clone();

    if let Some(github) = config["github"].as_str() {
        let mut url = github.to_string();
        if url.starts_with("git@github.com:") {
            url = url.replace("git@github.com:", "https://github.com/");
        }
        let repo_name = url.split('/').last().unwrap_or("repo").replace(".git", "");
        let candidate = Path::new(&folder_path).join(&repo_name);
        if candidate.exists() {
            repo_path = candidate.to_string_lossy().to_string();
        }
    }

    let ws = Workspace {
        name:         name.clone(),
        path:         folder_path.clone(),
        repo_path:    repo_path.clone(),
        workspace_id: None,
    };
    save_workspace(&app, &ws);

    OpenWorkspaceResult {
        success:   true,
        name:      Some(name),
        path:      Some(folder_path),
        repo_path: Some(repo_path),
        error:     None,
    }
}

#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog().file().blocking_pick_folder().map(|p| p.to_string())
}

#[tauri::command]
fn read_dir(path: String) -> Vec<FileItem> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() { return vec![]; }
    match fs::read_dir(p) {
        Ok(entries) => {
            let mut items: Vec<FileItem> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_name().to_string_lossy() != ".git")
                .map(|e| {
                    let path   = e.path();
                    let is_dir = path.is_dir();
                    FileItem {
                        name: e.file_name().to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                        is_dir,
                    }
                })
                .collect();

            items.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true,  false) => std::cmp::Ordering::Less,
                (false, true)  => std::cmp::Ordering::Greater,
                _              => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });

            items
        }
        Err(_) => vec![],
    }
}

#[tauri::command]
fn read_file(path: String) -> String {
    let p = Path::new(&path);
    if !p.exists() || p.is_dir() { return String::new(); }
    if let Ok(meta) = fs::metadata(p) {
        if meta.len() > 5 * 1024 * 1024 {
            return "// File too large to display (> 5MB)".to_string();
        }
    }
    fs::read_to_string(p).unwrap_or_default()
}

#[tauri::command]
fn write_file(path: String, content: String) -> OpResult {
    match fs::write(&path, content) {
        Ok(_)  => OpResult { success: true,  error: None },
        Err(e) => OpResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn create_file(path: String) -> OpResult {
    let p = Path::new(&path);
    if p.exists() {
        return OpResult { success: false, error: Some("Already exists".to_string()) };
    }
    if let Some(parent) = p.parent() { let _ = fs::create_dir_all(parent); }
    match fs::write(p, "") {
        Ok(_)  => OpResult { success: true,  error: None },
        Err(e) => OpResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn create_folder(path: String) -> OpResult {
    let p = Path::new(&path);
    if p.exists() {
        return OpResult { success: false, error: Some("Already exists".to_string()) };
    }
    match fs::create_dir_all(p) {
        Ok(_)  => OpResult { success: true,  error: None },
        Err(e) => OpResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn delete_path(path: String) -> OpResult {
    let p = Path::new(&path);
    if !p.exists() {
        return OpResult { success: false, error: Some("Path does not exist".to_string()) };
    }
    let result = if p.is_dir() { fs::remove_dir_all(p) } else { fs::remove_file(p) };
    match result {
        Ok(_)  => OpResult { success: true,  error: None },
        Err(e) => OpResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn rename_path(old_path: String, new_path: String) -> OpResult {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);
    if !old.exists() {
        return OpResult { success: false, error: Some("Source does not exist".to_string()) };
    }
    if new.exists() {
        return OpResult { success: false, error: Some("A file with that name already exists".to_string()) };
    }
    match fs::rename(old, new) {
        Ok(_)  => OpResult { success: true,  error: None },
        Err(e) => OpResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn run_command(command: String, cwd: String) -> String {
    if command.trim().is_empty() { return "Error: No command provided".to_string(); }
    let output = Command::new("sh")
        .arg("-c")
        .arg(&command)
        .current_dir(&cwd)
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                String::from_utf8_lossy(&out.stdout).to_string()
            } else {
                String::from_utf8_lossy(&out.stderr).to_string()
            }
        }
        Err(e) => format!("Error: {}", e),
    }
}

// ─────────────────────────────────────────
// APP ENTRY
// ─────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main")
                .expect("main window not found");

            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::WebViewExt;
                use webkit2gtk::SettingsExt;

                window.with_webview(|webview| {
                    let wk = webview.inner();

                    if let Some(settings) = wk.settings() {
                        // ✅ Enable all media
                        settings.set_enable_media_stream(true);
                        settings.set_enable_media(true);
                        settings.set_enable_mediasource(true);
                        settings.set_enable_media_capabilities(true);
                        settings.set_media_playback_requires_user_gesture(false);
                        settings.set_enable_encrypted_media(true);
                        settings.set_allow_universal_access_from_file_urls(true);
                        settings.set_allow_file_access_from_file_urls(true);

                        // ✅ Disable web security to allow localhost getUserMedia
                        settings.set_enable_write_console_messages_to_stdout(true);
                    }

                    // ✅ Auto-allow ALL permission requests
                    // This handles camera, mic, notifications etc
                    wk.connect_permission_request(|_view, request| {
                        use webkit2gtk::PermissionRequestExt;
                        println!("🔐 Permission requested — auto allowing");
                        request.allow();
                        true // handled
                    });

                }).expect("failed to configure webview");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspaces,
            remove_workspace,
            save_workspace_id,
            create_workspace,
            open_workspace_folder,
            select_folder,
            read_dir,
            read_file,
            write_file,
            create_file,
            create_folder,
            delete_path,
            rename_path,
            run_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
