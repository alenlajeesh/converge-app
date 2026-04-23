import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import ActivityBar  from "../components/ActivityBar";
import Sidebar      from "../components/Sidebar";
import Editor       from "../components/Editor";
import ContextMenu  from "../components/ContextMenu";
import Terminal     from "../components/Terminal";
import ChatView     from "../components/ChatView";
import CallView     from "../components/CallView";
import VideoView    from "../components/VideoView";
import TaskView from "../components/TaskView";
import * as api from "../api";
import "../styles/workspace.css";

function WorkspaceHome() {
  const { state }  = useLocation();
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { token }  = useAuth();

  const workspaceId = id;
  const rootPath    = state?.repoPath || state?.path;

  const [tree,         setTree]         = useState([]);
  const [expanded,     setExpanded]     = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [content,      setContent]      = useState("");
  const [openFiles,    setOpenFiles]    = useState([]);
  const [activeView,   setActiveView]   = useState("explorer");
  const [showTerminal, setShowTerminal] = useState(true);
  const [,  setTreeLoading]  = useState(false);
  const [,  setSelectedDir]  = useState(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true); // ✅ sidebar toggle
  const [dbWorkspace,  setDbWorkspace]  = useState(null);
  const [contextMenu,  setContextMenu]  = useState({
    visible: false, x: 0, y: 0, node: null
  });

  // ✅ Fetch fresh workspace from DB for joinCode
  useEffect(() => {
    if (!workspaceId || !token) return;
    fetch(`http://localhost:5000/api/workspace/${workspaceId}`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then((r) => r.json())
      .then((data) => { if (data._id) setDbWorkspace(data); })
      .catch(console.error);
  }, [workspaceId, token]);

  const joinCode = dbWorkspace?.joinCode || state?.joinCode;

  useEffect(() => {
    if (!rootPath) navigate("/", { replace: true });
  }, [rootPath, navigate]);

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

      {/* SIDEBAR */}
      <Sidebar
        tree={tree}
        expanded={expanded}
        toggleFolder={toggleFolder}
        openFile={openFile}
        setContextMenu={setContextMenu}
        setSelectedDir={setSelectedDir}
        open={sidebarOpen}
      />

      {/* MAIN */}
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
            <button
              className={`topbar-btn ${showTerminal ? "active" : ""}`}
              onClick={() => setShowTerminal((v) => !v)}
            >
              ⌨ Terminal
            </button>
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
          {activeView === "chat"  && <ChatView workspaceId={workspaceId} />}
		  {activeView === "tasks" && <TaskView workspaceId={workspaceId} />}
          {activeView === "call"  && <CallView />}
          {activeView === "video" && <VideoView />}
        </div>

        {showTerminal && (
          <Terminal
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
    </div>
  );
}

export default WorkspaceHome;
