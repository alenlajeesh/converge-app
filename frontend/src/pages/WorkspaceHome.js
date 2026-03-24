import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

function WorkspaceHome() {
  const { state } = useLocation();
  const rootPath = state?.path;

  const [tree, setTree] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState("");

  const [selectedDir, setSelectedDir] = useState(rootPath);

  // 🔥 Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("file"); // file | folder | rename
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);

  // 🌲 Build tree
  const buildTree = async (dirPath) => {
    const items = await window.api.readDir(dirPath);

    return items.map((item) => ({
      ...item,
      children: item.isDir ? [] : undefined,
    }));
  };

  const loadRoot = async () => {
    const children = await buildTree(rootPath);

    const rootNode = {
      name: rootPath.split("/").pop(),
      path: rootPath,
      isDir: true,
      children,
    };

    setTree([rootNode]);
  };

  useEffect(() => {
    if (rootPath) {
      setSelectedDir(rootPath);
      setExpanded({ [rootPath]: true });
      loadRoot();
    }
  }, [rootPath]);

  // 📂 Expand folder
  const toggleFolder = async (item) => {
    if (!item.isDir) return;

    const isOpen = expanded[item.path];

    if (isOpen) {
      setExpanded({ ...expanded, [item.path]: false });
    } else {
      const children = await buildTree(item.path);

      const updateTree = (nodes) =>
        nodes.map((n) => {
          if (n.path === item.path) return { ...n, children };
          if (n.children) return { ...n, children: updateTree(n.children) };
          return n;
        });

      setTree(updateTree(tree));
      setExpanded({ ...expanded, [item.path]: true });
    }
  };

  // 📄 Open file
  const openFile = async (file) => {
    if (file.isDir) return;

    const data = await window.api.readFile(file.path);
    setSelectedFile(file.path);
    setContent(data);
  };

  // 💾 Save
  const saveFile = async () => {
    if (!selectedFile) return;
    await window.api.writeFile(selectedFile, content);
  };

  // ⌨️ Ctrl + S
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // ➕ Create
  const handleCreate = async () => {
    if (!newName) return;

    if (modalType === "file") {
      const res = await window.api.createFile(selectedDir + "/" + newName);
      if (!res.success) return alert(res.error);
    }

    if (modalType === "folder") {
      const res = await window.api.createFolder(selectedDir + "/" + newName);
      if (!res.success) return alert(res.error);
    }

    setShowModal(false);
    setNewName("");
    loadRoot();
  };

const handleRename = async () => {
  if (!newName || !renameTarget) return;

  const newPath =
    renameTarget.path.substring(0, renameTarget.path.lastIndexOf("/")) +
    "/" +
    newName;

  const res = await window.api.renamePath(renameTarget.path, newPath);

  if (!res.success) {
    alert(res.error);
    return;
  }

  setShowModal(false);
  setNewName("");
  loadRoot();
};

  // ❌ Delete
  const deleteItem = async (p) => {
    await window.api.deletePath(p);
    loadRoot();
  };

  // 🌲 Render tree
  const renderTree = (nodes, level = 0) => {
    return nodes.map((node, i) => (
      <div key={i}>
        <div
          style={{
            paddingLeft: level * 12,
            display: "flex",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <span
            onClick={() => {
              if (node.isDir) {
                setSelectedDir(node.path);
                toggleFolder(node);
              } else {
                openFile(node);
              }
            }}
          >
            {node.isDir
              ? expanded[node.path]
                ? "📂"
                : "📁"
              : "📄"}{" "}
            {node.name}
          </span>

          <div>
            <span
              onClick={() => {
                setRenameTarget(node);
                setModalType("rename");
                setShowModal(true);
              }}
              style={{ marginRight: "5px", color: "#aaa" }}
            >
              ✏️
            </span>

            <span
              onClick={() => deleteItem(node.path)}
              style={{ color: "red" }}
            >
              ✕
            </span>
          </div>
        </div>

        {node.isDir &&
          expanded[node.path] &&
          node.children &&
          renderTree(node.children, level + 1)}
      </div>
    ));
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      
      {/* Sidebar */}
      <div
        style={{
          width: "260px",
          background: "#1e1e2f",
          color: "white",
          padding: "10px",
          overflowY: "auto",
        }}
      >
        <h3>Explorer</h3>

        <button onClick={() => {
          setModalType("file");
          setShowModal(true);
        }}>
          + File
        </button>

        <button onClick={() => {
          setModalType("folder");
          setShowModal(true);
        }}>
          + Folder
        </button>

        <div style={{ marginTop: "10px" }}>
          {renderTree(tree)}
        </div>
      </div>

      {/* Editor */}
      <div
        style={{
          flex: 1,
          background: "#12121a",
          color: "white",
          padding: "10px",
        }}
      >
        <h3>{selectedFile || "No file selected"}</h3>

        {selectedFile ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: "100%",
              height: "90%",
              background: "#1e1e2f",
              color: "white",
              border: "none",
              padding: "10px",
              fontFamily: "monospace",
            }}
          />
        ) : (
          <p>Select a file</p>
        )}
      </div>

      {/* 🔥 MODAL */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: "#1e1e2f",
              padding: "20px",
              borderRadius: "10px",
              width: "300px",
            }}
          >
            <h3>
              {modalType === "rename"
                ? "Rename"
                : modalType === "file"
                ? "New File"
                : "New Folder"}
            </h3>

            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ width: "100%", marginBottom: "10px" }}
            />

            <button
              onClick={
                modalType === "rename" ? handleRename : handleCreate
              }
            >
              Confirm
            </button>

            <button onClick={() => setShowModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceHome;
