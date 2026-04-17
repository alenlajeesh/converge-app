import TreeNode from "./TreeNode";

export default function Sidebar(props) {
  return (
    <div className="sidebar">
      <h3>EXPLORER</h3>

      <div className="tree">
        {props.tree.map((node, i) => (
          <TreeNode
            key={i}
            node={node}
            level={0}
            expanded={props.expanded}
            toggleFolder={props.toggleFolder}
            openFile={props.openFile}
            setContextMenu={props.setContextMenu}
            setSelectedDir={props.setSelectedDir}
          />
        ))}
      </div>
    </div>
  );
}
