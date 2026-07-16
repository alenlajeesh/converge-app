import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
function WorkspaceHome() {
  const { state }  = useLocation();
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { token, user } = useAuth();
  
  const workspaceId = id;
  const rootPath    = state?.repoPath || state?.path;

  // ── File tree ────────────────────────────
  const [tree,         setTree]         = useState([]);
  const [expanded,     setExpanded]     = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [content,      setContent]      = useState("");
  const [openFiles,    setOpenFiles]    = useState([]);

  // ── UI state ─────────────────────────────
  const [activeView,   setActiveView]   = useState("explorer");
  const [showTerminal, setShowTerminal] = useState(true);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [dbWorkspace,  setDbWorkspace]  = useState(null);
  const [contextMenu,  setContextMenu]  = useState({
    visible: false, x: 0, y: 0, node: null
  });

  // ── Call state ───────────────────────────
  const socketRef   = useRef(null);
  const [callNotif, setCallNotif] = useState(null);
  // callNotif = { participants, workspaceId, callType } | null

  // 🖥️ Chat toast stack — separate from callNotif so the call-notif
  // logic below is untouched, chat toasts just stack alongside it.
  const [chatToasts, setChatToasts] = useState([]);
  const chatToastIdRef = useRef(0);

  const dismissChatToast = useCallback((toastId) => {
    setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // 🖥️ Terminal panel ref — lets the MenuBar's "New Terminal" event
  // trigger a new tab inside the panel.
  const terminalPanelRef = useRef(null);

  // ── Unused but needed for setters ───────
  const [, setTreeLoading] = useState(false); // eslint-disable-line no-unused-vars
  const [, setSelectedDir] = useState(null);  // eslint-disable-line no-unused-vars

  // ── Fetch workspace from DB ──────────────
  useEffect(() => {
    if (!workspaceId || !token) return;
    fetch(`${apiUrl}/api/workspace/${workspaceId}`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then((r) => r.json())
      .then((data) => { if (data._id) setDbWorkspace(data); })
      .catch(console.error);
  }, [workspaceId, token]);

  const joinCode = dbWorkspace?.joinCode || state?.joinCode;

  // ── Redirect if no rootPath ──────────────
  useEffect(() => {
    if (!rootPath) navigate("/", { replace: true });
  }, [rootPath, navigate]);

  // ── 🖥️ Notifications ────────────────────────
  useEffect(() => {
    initNotifications();
  }, []);

  // ── 🖥️ Listen for MenuBar's "New Terminal" event ─────────
  useEffect(() => {
    const handleNewTerminal = () => {
      setShowTerminal(true);
      // Give the panel a tick to mount if it was hidden
      setTimeout(() => terminalPanelRef.current?.addTerminal(), 0);
    };
    window.addEventListener("converge:new-terminal", handleNewTerminal);
    return () => window.removeEventListener("converge:new-terminal", handleNewTerminal);
  }, []);

  // ── Workspace socket for call notifications
  useEffect(() => {
    if (!token || !workspaceId) return;

    const socket = io(`${apiUrl}`, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-workspace", { workspaceId });
    });

    // Show notification when a call becomes active
    socket.on("call-active", ({ participants, workspaceId: wid }) => {
      if (!participants || participants.length === 0) return;

      const callType = participants[0]?.callType || "audio";

      // Don't show notification if already in call view
      setActiveView((current) => {
        if (current === "call" || current === "video") return current;
        setCallNotif({ participants, workspaceId: wid, callType });
        return current;
      });

      // 🖥️ Native OS toast if the window isn't focused right now
      notifyIfUnfocused(
        `${callType === "video" ? "Video" : "Voice"} call started`,
        participants.map((p) => p.username).join(", ")
      );
    });

    // Hide notification when call ends
    socket.on("call-ended", () => {
      setCallNotif(null);
    });

    // 🖥️ Chat notifications — this socket already joined the workspace
    // room via join-workspace, so it receives receive-message broadcasts
    // the same as ChatView does. Skip our own messages and skip the
    // toast (but not the OS notification) if Chat is already open.
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

  const workspaceName = dbWorkspace?.name
    || rootPath?.split(/[\\/]/).pop()
    || "Workspace";

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

      {/* ACTIVITY BAR */}
      <ActivityBar
        active={activeView}
        setActive={setActiveView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* SIDEBAR — always visible */}
      <Sidebar
        tree={tree}
        expanded={expanded}
        toggleFolder={toggleFolder}
        openFile={openFile}
        setContextMenu={setContextMenu}
        setSelectedDir={setSelectedDir}
        open={sidebarOpen}
      />

      {/* MAIN AREA */}
      <div className="main-area">

        {/* TOPBAR */}
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

        {/* CONTENT AREA */}
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
            <ChatView workspaceId={workspaceId} />
          )}

          {activeView === "tasks" && (
            <TaskView workspaceId={workspaceId} />
          )}

          {activeView === "call" && (
            <CallView
              socket={socketRef.current}
              workspaceId={workspaceId}
              user={user}
            />
          )}

          {activeView === "video" && (
            <VideoView
              socket={socketRef.current}
              workspaceId={workspaceId}
              user={user}
            />
          )}
        </div>

        {/* TERMINAL */}
        {showTerminal && (
          <TerminalPanel
            ref={terminalPanelRef}
            rootPath={rootPath}
            onClose={() => setShowTerminal(false)}
          />
        )}
      </div>

      {/* CONTEXT MENU */}
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

      {/* 🖥️ NOTIFICATION TOAST STACK — call notif + chat toasts */}
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