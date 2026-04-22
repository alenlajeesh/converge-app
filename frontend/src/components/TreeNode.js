export default function TreeNode({
  node,
  level,
  expanded,
  toggleFolder,
  openFile,
  setSelectedDir,
  setContextMenu,
}) {
  const isExpanded = expanded[node.path];

  const handleClick = () => {
    if (node.isDir) {
      setSelectedDir?.(node.path);
      toggleFolder(node);
    } else {
      openFile(node);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  return (
    <div>
      <div
        className="tree-node"
        style={{ paddingLeft: `${12 + level * 12}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <span className="tree-node-icon">
          {node.isDir
            ? isExpanded ? "📂" : "📁"
            : getFileIcon(node.name)}
        </span>
        <span className="tree-node-name">{node.name}</span>
      </div>

      {node.isDir && isExpanded && node.children?.map((child, i) => (
        <TreeNode
          key={child.path || i}
          node={child}
          level={level + 1}
          expanded={expanded}
          toggleFolder={toggleFolder}
          openFile={openFile}
          setSelectedDir={setSelectedDir}
          setContextMenu={setContextMenu}
        />
      ))}
    </div>
  );
}

function getFileIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  const icons = {
    js:    "🟨", jsx:  "🟨",
    ts:    "🔷", tsx:  "🔷",
    json:  "📋",
    css:   "🎨",
    html:  "🌐",
    md:    "📝",
    py:    "🐍",
    env:   "🔒",
    gitignore: "🔒",
    png:   "🖼️", jpg: "🖼️", jpeg: "🖼️", svg: "🖼️",
  };
  return icons[ext] || "📄";
}
