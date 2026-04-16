import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import ActivityBar from "../components/ActivityBar";
import Sidebar from "../components/Sidebar";
import Editor from "../components/Editor";
import ContextMenu from "../components/ContextMenu";
import Terminal from "../components/Terminal";

import ChatView from "../components/ChatView";
import CallView from "../components/CallView";
import VideoView from "../components/VideoView";

import "../styles/workspace.css";

function WorkspaceHome() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const rootPath = state?.repoPath || state?.path;

  const [tree, setTree] = useState([]);
  const [showTerminal, setShowTerminal] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState("");
  const [selectedDir, setSelectedDir] = useState(rootPath);

  const [openFiles, setOpenFiles] = useState([]);
  const [activeView, setActiveView] = useState("explorer");

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  // 🔐 Redirect if no workspace
  useEffect(() => {
    if (!rootPath) {
      navigate("/");
    }
  }, [rootPath, navigate]);

  // 🌲 Build directory tree
  const buildTree = async (dirPath) => {
    try {
      const items = await window.api.readDir(dirPath);

      return items.map((item) => ({
        ...item,
        children: item.isDir ? [] : undefined,
      }));
    } catch (err) {
      console.error("Error reading directory:", err);
      return [];
    }
  };

  // 📂 Load root directory
  const loadRoot = async () => {
    if (!rootPath) return;

    const children = await buildTree(rootPath);

    setTree([
      {
        name: rootPath.split("/").pop(),
        path: rootPath,
        isDir: true,
        children,
      },
    ]);
  };

  useEffect(() => {
    if (rootPath) {
      setSelectedDir(rootPath);
      setExpanded({ [rootPath]: true });
      loadRoot();
    }
  }, [rootPath]);

  // 📂 Toggle folder
  const toggleFolder = async (item) => {
    if (!item.isDir) return;

    const isOpen = expanded[item.path];

    if (isOpen) {
      setExpanded((prev) => ({
        ...prev,
        [item.path]: false,
      }));
    } else {
      const children = await buildTree(item.path);

      const updateTree = (nodes) =>
        nodes.map((n) => {
          if (n.path === item.path) {
            return { ...n, children };
          }
          if (n.children) {
            return { ...n, children: updateTree(n.children) };
          }
          return n;
        });

      setTree((prev) => updateTree(prev));

      setExpanded((prev) => ({
        ...prev,
        [item.path]: true,
      }));
    }
  };

  // 📄 Open file
  const openFile = async (file) => {
    if (file.isDir) return;

    try {
      const data = await window.api.readFile(file.path);

      setSelectedFile(file.path);
      setContent(data);

      setOpenFiles((prev) => {
        if (prev.includes(file.path)) return prev;
        return [...prev, file.path];
      });
    } catch (err) {
      console.error("Error opening file:", err);
    }
  };

  // 🔄 Switch tab
  const setActiveFile = async (filePath) => {
    try {
      const data = await window.api.readFile(filePath);
      setSelectedFile(filePath);
      setContent(data);
    } catch (err) {
      console.error("Error switching file:", err);
    }
  };

  // ❌ Close tab
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

  // 🖱 Context menu actions
  const handleContextAction = async (action) => {
    const node = contextMenu.node;
    if (!node) return;

    const parentPath = node.isDir
      ? node.path
      : node.path.substring(0, node.path.lastIndexOf("/"));

    try {
      if (action === "newFile") {
        await window.api.createFile(parentPath + "/newFile");
      }

      if (action === "newFolder") {
        await window.api.createFolder(parentPath + "/newFolder");
      }

      if (action === "rename") {
        const newName = prompt("Enter new name");
        if (!newName) return;

        const newPath = parentPath + "/" + newName;
        await window.api.renamePath(node.path, newPath);
      }

      if (action === "delete") {
        await window.api.deletePath(node.path);
      }

      await loadRoot();
    } catch (err) {
      console.error("Context action failed:", err);
    }

    setContextMenu((prev) => ({ ...prev, visible: false }));
  };
	return (
  <div className="workspace">
    {/* LEFT ICON BAR */}
    <ActivityBar active={activeView} setActive={setActiveView} />

    {/* SIDEBAR */}
    <Sidebar
      tree={tree}
      expanded={expanded}
      toggleFolder={toggleFolder}
      openFile={openFile}
      setSelectedDir={setSelectedDir}
      setContextMenu={setContextMenu}
    />

    {/* MAIN AREA */}
    <div className="main-area">
      {/* TOP BAR */}
      <div className="topbar">
        <span className="workspace-name">
          {rootPath?.split("/").pop()}
        </span>

        <div className="topbar-actions">
          <button
            className="terminal-toggle"
            onClick={() => setShowTerminal(!showTerminal)}
          >
            Terminal
          </button>

          <button
            className="back-btn"
            onClick={() => navigate("/")}
          >
            ← Back
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
		{activeView === "chat" && (
			<ChatView
				workspaceId={state?.workspaceId}
				username={"User_" + Date.now()}
			/>
		)}
        {activeView === "call" && <CallView />}
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
      onClose={() =>
        setContextMenu((prev) => ({ ...prev, visible: false }))
      }
      onAction={handleContextAction}
    />
  </div>
);

}

export default WorkspaceHome;
