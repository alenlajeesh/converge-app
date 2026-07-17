import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { io } from "socket.io-client";

import ActivityBar       from "../components/ActivityBar";
import Sidebar           from "../components/Sidebar";
import Editor            from "../components/Editor";
import ContextMenu       from "../components/ContextMenu";
import TerminalPanel     from "../components/TerminalPanel";
import ChatView          from "../components/ChatView";
import CallView          from "../components/CallView";
import VideoView         from "../components/VideoView";
import TaskView          from "../components/TaskView";
import NotificationToast from "../components/NotificationToast";

import { initNotifications, notifyIfUnfocused } from "../utils/notifications";

import * as api from "../api";
import "../styles/workspace.css";

const apiUrl = process.env.REACT_APP_API_URL;

function LoginRequired({ feature }) {
  const navigate = useNavigate();
  return (
    <div className="login-required">
      <div className="login-required-icon">🔒</div>
      <h3>Log in to use {feature}</h3>
      <p>This feature needs an account so your team can see it too.</p>
      <button className="btn btn-primary" onClick={() => navigate("/auth")}>
        Log In
      </button>
    </div>
  );
}

function WorkspaceHome() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const { token, user } = useAuth();

  const rootPath = state?.repoPath || state?.path;

  const [workspaceId, setWorkspaceId] = useState(state?.workspaceId || null);
  const [dbWorkspace, setDbWorkspace] = useState(null);

  // ── File tree ────────────────────────────
  const [tree,         setTree]         = useState([]);
  const [expanded,     setExpanded]     = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [content,      setContent]      = useState("");
  const [openFiles,    setOpenFiles]    = useState([]);

  // ── UI state ─────────────────────────────
  const [activeView,   setActiveView]   = useState("explorer");
  const [showTerminal, setShowTerminal] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [contextMenu,  setContextMenu]  = useState({
    visible: false, x: 0, y: 0, node: null
  });

  // ── Call state ───────────────────────────
  const socketRef   = useRef(null);
  const [callNotif, setCallNotif] = useState(null);

  const [chatToasts, setChatToasts] = useState([]);
  const chatToastIdRef = useRef(0);

  const dismissChatToast = useCallback((toastId) => {
    setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // 🖥️ Terminal panel ref — lets the MenuBar's "New Terminal" event
  // trigger a new tab inside the panel.
  const terminalPanelRef = useRef(null);

  const [, setTreeLoading] = useState(false); // eslint-disable-line no-unused-vars
  const [, setSelectedDir] = useState(null);  // eslint-disable-line no-unused-vars

  useEffect(() => {
    if (!rootPath) navigate("/", { replace: true });
  }, [rootPath, navigate]);

  const fallbackName = rootPath?.split(/[\\/]/).pop() || "Workspace";
  const workspaceName = dbWorkspace?.name || state?.name || fallbackName;
  const joinCode = dbWorkspace?.joinCode || state?.joinCode;

  useEffect(() => {
    if (!token || workspaceId || !rootPath) return;
    let cancelled = false;

    fetch(`${apiUrl}/api/workspace/link`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  "Bearer " + token
      },
      body: JSON.stringify({
        localPath: rootPath,
        name:      state?.name || fallbackName
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data._id) return;
        setWorkspaceId(data._id);
        setDbWorkspace(data);
        api.saveWorkspaceId(rootPath, data._id).catch(() => {});
      })
      .catch((err) => console.error("Background workspace link failed:", err));

    return () => { cancelled = true; };
  }, [token, workspaceId, rootPath, state?.name, fallbackName]);

  useEffect(() => {
    if (!workspaceId || !token || dbWorkspace) return;
    let cancelled = false;

    fetch(`${apiUrl}/api/workspace/${workspaceId}`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data._id) setDbWorkspace(data); })
      .catch(console.error);

    return () => { cancelled = true; };
  }, [workspaceId, token, dbWorkspace]);

  useEffect(() => {
    initNotifications();
  }, []);

  // ── 🖥️ Listen for MenuBar's "New Terminal" event ─────────
  // FIX: TerminalPanel already creates its own first terminal on
  // mount. Previously we always called addTerminal() after opening
  // the panel, which meant the very first "New Terminal" click
  // produced two shells (one from the panel's initial state, one
  // from addTerminal()). Now we only call addTerminal() when the
  // panel is already open/mounted.
  useEffect(() => {
    const handleNewTerminal = () => {
      setShowTerminal((prevShown) => {
        if (prevShown) {
          terminalPanelRef.current?.addTerminal();
        }
        return true;
      });
    };
    window.addEventListener("converge:new-terminal", handleNewTerminal);
    return () => window.removeEventListener("converge:new-terminal", handleNewTerminal);
  }, []);

  // ── Workspace socket for call/chat notifications ─────────
  useEffect(() => {
    if (!token || !workspaceId) return;

    const socket = io(`${apiUrl}`, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-workspace", { workspaceId });
    });

    socket.on("call-active", ({ participants, workspaceId: wid }) => {
      if (!participants || participants.length === 0) return;

      const callType = participants[0]?.callType || "audio";

      setActiveView((current) => {
        if (current === "call" || current === "video") return current;
        setCallNotif({ participants, workspaceId: wid, callType });
        return current;
      });

      notifyIfUnfocused(
        `${callType === "video" ? "Video" : "Voice"} call started`,
        participants.map((p) => p.username).join(", ")
      );
    });

    socket.on("call-ended", () => {
      setCallNotif(null);
    });

    socket.on("receive-message", (msg) => {
      if (!msg || !user) return;
      const isOwn = String(msg.userId) === String(user.id);
      if (isOwn) return;

      setActiveView((current) => {
        if (current !== "chat") {
          setChatToasts((prev) => [
            ...prev,
            {
              id: ++chatToastIdRef.current,
              type: "chat",
              username: msg.username,
              message: msg.message
            }
          ]);
        }
        return current;
      });

      notifyIfUnfocused(msg.username, msg.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, workspaceId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File tree ────────────────────────────
  const buildTree = useCallback(async (dirPath) => {
    try {
      const items = await api.readDir(dirPath);
      return items
        .sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((item) => ({
          ...item,
          children: item.isDir ? [] : undefined
        }));
    } catch (err) {
      console.error("readDir error:", err);
      return [];
    }
  }, []);

  const loadRoot = useCallback(async () => {
    if (!rootPath) return;
    setTreeLoading(true);
    try {
      const children = await buildTree(rootPath);
      setTree([{
        name:     rootPath.split(/[\\/]/).pop(),
        path:     rootPath,
        isDir:    true,
        children
      }]);
      setExpanded({ [rootPath]: true });
    } catch (err) {
      console.error("loadRoot error:", err);
    } finally {
      setTreeLoading(false);
    }
  }, [rootPath, buildTree]);

  useEffect(() => {
    if (rootPath) loadRoot();
  }, [rootPath, loadRoot]);

  const toggleFolder = async (item) => {
    if (!item.isDir) return;
    if (expanded[item.path]) {
      setExpanded((prev) => ({ ...prev, [item.path]: false }));
      return;
    }
    const children = await buildTree(item.path);
    const updateTree = (nodes) =>
      nodes.map((n) => {
        if (n.path === item.path) return { ...n, children };
        if (n.children)           return { ...n, children: updateTree(n.children) };
        return n;
      });
    setTree((prev) => updateTree(prev));
    setExpanded((prev) => ({ ...prev, [item.path]: true }));
  };

  const openFile = async (file) => {
    if (file.isDir) { toggleFolder(file); return; }
    try {
      const data = await api.readFile(file.path);
      setSelectedFile(file.path);
      setContent(data);
      setSelectedDir(
        file.path.substring(0, file.path.lastIndexOf(
          file.path.includes("/") ? "/" : "\\"
        ))
      );
      setOpenFiles((prev) =>
        prev.includes(file.path) ? prev : [...prev, file.path]
      );
      setActiveView("explorer");
    } catch (err) {
      console.error("openFile error:", err);
    }
  };

  const setActiveFile = async (filePath) => {
    try {
      const data = await api.readFile(filePath);
      setSelectedFile(filePath);
      setContent(data);
    } catch (err) {
      console.error("setActiveFile error:", err);
    }
  };

  const closeFile = useCallback((filePath) => {
    setOpenFiles((prev) => {
      const updated = prev.filter((f) => f !== filePath);
      if (filePath === selectedFile) {
        if (updated.length > 0) {
          setActiveFile(updated[updated.length - 1]);
        } else {
          setSelectedFile(null);
          setContent("");
        }
      }
      return updated;
    });
  }, [selectedFile]);

  // ── Context menu actions ─────────────────
  const handleContextAction = async (action, node) => {
    if (!node) return;
    const sep       = node.path.includes("/") ? "/" : "\\";
    const targetDir = node.isDir
      ? node.path
      : node.path.substring(0, node.path.lastIndexOf(sep));

    if (action === "newFile") {
      let fileName = "newFile";
      let counter  = 1;
      while (counter <= 20) {
        const result = await api.createFile(targetDir + sep + fileName);
        if (result.success) break;
        fileName = `newFile${counter++}`;
      }
      await loadRoot();
    }

    if (action === "newFolder") {
      let folderName = "newFolder";
      let counter    = 1;
      while (counter <= 20) {
        const result = await api.createFolder(targetDir + sep + folderName);
        if (result.success) break;
        folderName = `newFolder${counter++}`;
      }
      await loadRoot();
    }
  };

  const handleRename = async (node, newName) => {
    const sep        = node.path.includes("/") ? "/" : "\\";
    const parentPath = node.path.substring(0, node.path.lastIndexOf(sep));
    const newPath    = parentPath + sep + newName;
    try {
      const result = await api.renamePath(node.path, newPath);
      if (!result.success) { console.error(result.error); return; }
      if (openFiles.includes(node.path)) {
        setOpenFiles((prev) => prev.map((f) => f === node.path ? newPath : f));
        if (selectedFile === node.path) setSelectedFile(newPath);
      }
      await loadRoot();
    } catch (err) {
      console.error("Rename failed:", err);
    }
  };

  const handleDelete = async (node) => {
    try {
      await api.deletePath(node.path);
      if (openFiles.includes(node.path)) closeFile(node.path);
      await loadRoot();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (!rootPath) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "#0f172a",
        display: "flex", alignItems: "center",
        justifyContent: "center",
        color: "#475569", fontSize: 14
      }}>
        Redirecting...
      </div>
    );
  }

  return (
    <div className="workspace">

      <ActivityBar
        active={activeView}
        setActive={setActiveView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <Sidebar
        tree={tree}
        expanded={expanded}
        toggleFolder={toggleFolder}
        openFile={openFile}
        setContextMenu={setContextMenu}
        setSelectedDir={setSelectedDir}
        open={sidebarOpen}
      />

      <div className="main-area">

        <div className="topbar">
          <div className="topbar-left">
            <span className="workspace-name">{workspaceName}</span>
            {joinCode && (
              <div className="topbar-joincode">
                <span>Invite:</span>
                <strong>{joinCode}</strong>
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <button className="topbar-btn" onClick={() => navigate("/")}>
              ← Home
            </button>
          </div>
        </div>

        <div className="editor-area">
          {activeView === "explorer" && (
            <Editor
              selectedFile={selectedFile}
              content={content}
              setContent={setContent}
              openFiles={openFiles}
              setActiveFile={setActiveFile}
              closeFile={closeFile}
            />
          )}

          {activeView === "chat" && (
            user
              ? <ChatView workspaceId={workspaceId} />
              : <LoginRequired feature="chat" />
          )}

          {activeView === "tasks" && (
            user
              ? <TaskView workspaceId={workspaceId} />
              : <LoginRequired feature="tasks" />
          )}

          {activeView === "call" && (
            user
              ? <CallView socket={socketRef.current} workspaceId={workspaceId} user={user} />
              : <LoginRequired feature="voice calls" />
          )}

          {activeView === "video" && (
            user
              ? <VideoView socket={socketRef.current} workspaceId={workspaceId} user={user} />
              : <LoginRequired feature="video calls" />
          )}
        </div>

        {showTerminal && (
          <TerminalPanel
            ref={terminalPanelRef}
            rootPath={rootPath}
            onClose={() => setShowTerminal(false)}
          />
        )}
      </div>

      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenu.visible}
        node={contextMenu.node}
        onClose={() => setContextMenu((p) => ({ ...p, visible: false }))}
        onAction={handleContextAction}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <div className="toast-stack">
        {callNotif && (
          <NotificationToast
            toast={{
              id: "call",
              type: "call",
              callType: callNotif.callType,
              participants: callNotif.participants
            }}
            onJoin={() => {
              const view = callNotif.callType === "video" ? "video" : "call";
              setActiveView(view);
              setSidebarOpen(false);
              setCallNotif(null);
            }}
            onDismiss={() => setCallNotif(null)}
          />
        )}
        {chatToasts.map((t) => (
          <NotificationToast
            key={t.id}
            toast={t}
            onJoin={() => {}}
            onDismiss={dismissChatToast}
          />
        ))}
      </div>
    </div>
  );
}

export default WorkspaceHome;