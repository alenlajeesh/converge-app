import TreeNode from "./TreeNode";

export default function Sidebar({
  tree = [],
  expanded = {},
  toggleFolder,
  openFile,
  setContextMenu,
  setSelectedDir,
  open = true,
}) {
  return (
    <div
      className="sidebar"
      style={{
        width:      open ? "240px" : "0px",
        minWidth:   open ? "240px" : "0px",
        overflow:   "hidden",
        transition: "width 0.22s ease, min-width 0.22s ease",
      }}
    >
      <div className="sidebar-header">EXPLORER</div>
      <div className="tree">
        {tree.length === 0 ? (
          <div className="tree-empty">Loading...</div>
        ) : (
          tree.map((node, i) => (
            <TreeNode
              key={node.path || i}
              node={node}
              level={0}
              expanded={expanded}
              toggleFolder={toggleFolder}
              openFile={openFile}
              setContextMenu={setContextMenu}
              setSelectedDir={setSelectedDir}
            />
          ))
        )}
      </div>
    </div>
  );
}
