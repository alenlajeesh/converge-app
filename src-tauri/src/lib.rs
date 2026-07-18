use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Prevents the black cmd.exe console window from flashing on screen
// every time a command runs on Windows.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

    #[cfg(target_os = "windows")]
    let output = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &command]);
        cmd.current_dir(&cwd);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.output()
    };

    #[cfg(not(target_os = "windows"))]
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
// 🎨 APP SETTINGS (theme, etc.)
// ─────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String, // "dark" | "light"
}

fn default_theme() -> String { "dark".to_string() }

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings { theme: default_theme() }
    }
}

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("settings.json")
}

fn read_settings(app: &tauri::AppHandle) -> AppSettings {
    let path = get_settings_path(app);
    if !path.exists() { return AppSettings::default(); }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

fn write_settings(app: &tauri::AppHandle, settings: &AppSettings) {
    let path = get_settings_path(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, serde_json::to_string_pretty(settings).unwrap());
}

#[tauri::command]
fn get_theme(app: tauri::AppHandle) -> String {
    read_settings(&app).theme
}

#[tauri::command]
fn set_theme(app: tauri::AppHandle, theme: String) -> OpResult {
    let mut settings = read_settings(&app);
    settings.theme = theme;
    write_settings(&app, &settings);
    OpResult { success: true, error: None }
}

// ─────────────────────────────────────────
// 🖥️ AUTOSTART (launch on Windows login)
// ─────────────────────────────────────────

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

// ─────────────────────────────────────────
// 🖥️ REAL TERMINAL (PTY) SESSIONS
// ─────────────────────────────────────────

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child:  Box<dyn Child + Send + Sync>,
}

struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
}

#[tauri::command]
fn create_pty_session(
    app: tauri::AppHandle,
    state: tauri::State<PtyState>,
    id: String,
    cwd: String,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let shell = "powershell.exe".to_string();
    #[cfg(not(target_os = "windows"))]
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

    let mut cmd = CommandBuilder::new(shell);
    if !cwd.is_empty() {
        cmd.cwd(&cwd);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    // Drop the slave handle in the parent process — the child keeps it open.
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Reader thread: streams PTY output to the frontend as it arrives.
    let id_for_thread = id.clone();
    let app_for_thread = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF — shell exited
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_for_thread.emit(&format!("pty-output-{}", id_for_thread), chunk);
                }
                Err(_) => break,
            }
        }
        let _ = app_for_thread.emit(&format!("pty-closed-{}", id_for_thread), ());
    });

    let mut sessions = state.sessions.lock().unwrap();
    sessions.insert(id, PtySession { master: pair.master, writer, child });

    Ok(())
}

#[tauri::command]
fn write_to_pty(state: tauri::State<PtyState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn resize_pty(state: tauri::State<PtyState>, id: String, rows: u16, cols: u16) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&id) {
        session
            .master
            .resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_pty_session(state: tauri::State<PtyState>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}

// ─────────────────────────────────────────
// APP ENTRY
// ─────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ✅ Fixes video flickering in the installed/compiled app on Windows.
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--disable-gpu-compositing --disable-features=CalculateNativeWinOcclusion"
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        // 🖥️ Flag flipped only by the tray "Quit" item — lets the window
        // CloseRequested handler tell a real quit apart from the user
        // just clicking the window's X button.
        .manage(Arc::new(AtomicBool::new(false)))
        .manage(PtyState { sessions: Mutex::new(HashMap::new()) })
        .setup(|app| {
            let window = app.get_webview_window("main")
                .expect("main window not found");

            // ── 🖥️ SYSTEM TRAY ──────────────────────────
            let open_item = MenuItemBuilder::new("Open Converge").id("open").build(app)?;
            let quit_item = MenuItemBuilder::new("Quit").id("quit").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&open_item, &quit_item])
                .build()?;

            let quitting: Arc<AtomicBool> = app.state::<Arc<AtomicBool>>().inner().clone();
            let quitting_for_menu = quitting.clone();

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Converge")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        quitting_for_menu.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                        // Only react to a LEFT click here. Right-click already shows the
                        // menu (Open/Quit) automatically since it's attached via .menu()
                        // — we must not touch the window on right-click, or we steal
                        // focus and the menu closes before you can see it.
                        if let TrayIconEvent::Click { button, button_state, .. } = event {
                            if button == tauri::tray::MouseButton::Left
                                && button_state == tauri::tray::MouseButtonState::Up
                            {
                                let app = tray.app_handle();
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.unminimize();
                                    let _ = w.set_focus();
                                }
                            }
                        }
                    })
                .build(app)?;

            // ── 🖥️ CLOSE-TO-TRAY ────────────────────────
            // Clicking the window's X hides it instead of exiting the
            // process — the socket connection (and call/chat state)
            // stays alive in the background, same as Discord/Slack.
            // Only the tray's "Quit" sets `quitting` and actually exits.
            let close_window   = window.clone();
            let quitting_close = quitting.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if !quitting_close.load(Ordering::SeqCst) {
                        let _ = close_window.hide();
                        api.prevent_close();
                    }
                }
            });

            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::WebViewExt;
                use webkit2gtk::SettingsExt;

                window.with_webview(|webview| {
                    let wk = webview.inner();

                    if let Some(settings) = wk.settings() {
                        settings.set_enable_media_stream(true);
                        settings.set_enable_media(true);
                        settings.set_enable_mediasource(true);
                        settings.set_enable_media_capabilities(true);
                        settings.set_media_playback_requires_user_gesture(false);
                        settings.set_enable_encrypted_media(true);
                        settings.set_allow_universal_access_from_file_urls(true);
                        settings.set_allow_file_access_from_file_urls(true);
                        settings.set_enable_write_console_messages_to_stdout(true);
                    }

                    wk.connect_permission_request(|_view, request| {
                        use webkit2gtk::PermissionRequestExt;
                        println!("🔐 Permission requested — auto allowing");
                        request.allow();
                        true
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
            set_autostart,
            get_autostart,
            create_pty_session,
            write_to_pty,
            resize_pty,
            close_pty_session,
            get_theme,
            set_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}