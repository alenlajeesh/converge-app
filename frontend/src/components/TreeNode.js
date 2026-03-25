export default function TreeNode({
  node,
  level,
  expanded,
  toggleFolder,
  openFile,
  setSelectedDir,
  setContextMenu,
}) {
  return (
    <div>
      <div
        className="tree-node"
        style={{ paddingLeft: level * 12 }}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({
            visible: true,
            x: e.pageX,
            y: e.pageY,
            node,
          });
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
            : "📄"} {node.name}
        </span>
      </div>

      {node.isDir &&
        expanded[node.path] &&
        node.children?.map((child, i) => (
          <TreeNode key={i} node={child} level={level + 1} expanded={expanded} toggleFolder={toggleFolder} openFile={openFile} setSelectedDir={setSelectedDir} setContextMenu={setContextMenu} />
        ))}
    </div>
  );
}
