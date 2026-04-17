import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import ActivityBar  from "../components/ActivityBar";
import Sidebar      from "../components/Sidebar";
import Editor       from "../components/Editor";
import ContextMenu  from "../components/ContextMenu";
import Terminal     from "../components/Terminal";
import ChatView     from "../components/ChatView";
import CallView     from "../components/CallView";
import VideoView    from "../components/VideoView";

import "../styles/workspace.css";

function WorkspaceHome() {
  const { state }    = useLocation();
  const { id }       = useParams();
  const navigate     = useNavigate();

  const workspaceId  = id;
  const joinCode     = state?.joinCode;
  const rootPath     = state?.repoPath || state?.path;

  const [tree,         setTree]         = useState([]);
  const [expanded,     setExpanded]     = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [content,      setContent]      = useState("");
  const [openFiles,    setOpenFiles]    = useState([]);
  const [activeView,   setActiveView]   = useState("explorer");
  const [showTerminal, setShowTerminal] = useState(true);
  const [treeLoading,  setTreeLoading]  = useState(false);
  const [contextMenu,  setContextMenu]  = useState({
    visible: false, x: 0, y: 0, node: null
  });

  // Redirect if no path
  useEffect(() => {
    if (!rootPath) {
      console.error("❌ No rootPath — redirecting");
      navigate("/");
    }
  }, [rootPath, navigate]);

  // Build tree nodes
  const buildTree = async (dirPath) => {
    try {
      const items = await window.api.readDir(dirPath);
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
  };

  // Load root
  const loadRoot = async () => {
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
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    if (rootPath) loadRoot();
  }, [rootPath]);

  // Toggle folder
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

  // Open file
  const openFile = async (file) => {
    if (file.isDir) { toggleFolder(file); return; }

    try {
      const data = await window.api.readFile(file.path);
      setSelectedFile(file.path);
      setContent(data);
      setOpenFiles((prev) =>
        prev.includes(file.path) ? prev : [...prev, file.path]
      );
      setActiveView("explorer");
    } catch (err) {
      console.error("openFile error:", err);
    }
  };

  // Switch tab
  const setActiveFile = async (filePath) => {
    try {
      const data = await window.api.readFile(filePath);
      setSelectedFile(filePath);
      setContent(data);
    } catch (err) {
      console.error("setActiveFile error:", err);
    }
  };

  // Close tab
  const closeFile = (filePath) => {
    const updated = openFiles.filter((f) => f !== filePath);
    setOpenFiles(updated);

    if (filePath === selectedFile) {
      if (updated.length > 0) {
        setActiveFile(updated[updated.length - 1]);
      } else {
        setSelectedFile(null);
        setContent("");
      }
    }
  };

  // Context menu action
  const handleContextAction = async (action) => {
    const node = contextMenu.node;
    if (!node) return;

    const sep        = node.path.includes("/") ? "/" : "\\";
    const parentPath = node.isDir
      ? node.path
      : node.path.substring(0, node.path.lastIndexOf(sep));

    try {
      if (action === "newFile") {
        let fileName = "newFile";
        let counter  = 1;
        while (true) {
          const candidate = parentPath + sep + fileName;
          const result    = await window.api.createFile(candidate);
          if (result.success) break;
          fileName = `newFile${counter++}`;
        }
      }

      if (action === "newFolder") {
        let folderName = "newFolder";
        let counter    = 1;
        while (true) {
          const candidate = parentPath + sep + folderName;
          const result    = await window.api.createFolder(candidate);
          if (result.success) break;
          folderName = `newFolder${counter++}`;
        }
      }

      if (action === "rename") {
        const newName = prompt("Rename to:");
        if (!newName?.trim()) return;
        const newPath = parentPath + sep + newName.trim();
        const result  = await window.api.renamePath(node.path, newPath);
        if (!result.success) { alert(result.error); return; }
      }

      if (action === "delete") {
        if (!confirm(`Delete "${node.name}"?`)) return;
        await window.api.deletePath(node.path);
        if (openFiles.includes(node.path)) closeFile(node.path);
      }

      await loadRoot();
    } catch (err) {
      console.error("Context action failed:", err);
    }

    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const workspaceName = rootPath?.split(/[\\/]/).pop() || "Workspace";

  return (
    <div className="workspace" onClick={() =>
      contextMenu.visible &&
      setContextMenu((p) => ({ ...p, visible: false }))
    }>
      {/* ACTIVITY BAR */}
      <ActivityBar active={activeView} setActive={setActiveView} />

      {/* SIDEBAR — always visible */}
      <Sidebar
        tree={tree}
        expanded={expanded}
        loading={treeLoading}
        toggleFolder={toggleFolder}
        openFile={openFile}
        setContextMenu={setContextMenu}
      />

      {/* MAIN */}
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
            <button
              className={`topbar-btn ${showTerminal ? "active" : ""}`}
              onClick={() => setShowTerminal(!showTerminal)}
            >
              ⌨ Terminal
            </button>
            <button className="topbar-btn" onClick={() => navigate("/")}>
              ← Home
            </button>
          </div>
        </div>

        {/* CONTENT */}
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
          {activeView === "call"  && <CallView />}
          {activeView === "video" && <VideoView />}
        </div>

        {/* TERMINAL */}
        {showTerminal && (
          <Terminal
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
        onClose={() => setContextMenu((p) => ({ ...p, visible: false }))}
        onAction={handleContextAction}
      />
    </div>
  );
}

export default WorkspaceHome;
