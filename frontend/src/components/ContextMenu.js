import { useEffect } from "react";

export default function ContextMenu({ x, y, visible, onClose, onAction }) {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="context-menu" style={{ top: y, left: x }}>
      <div onClick={() => onAction("newFile")}>New File</div>
      <div onClick={() => onAction("newFolder")}>New Folder</div>
      <div onClick={() => onAction("rename")}>Rename</div>
      <div className="danger" onClick={() => onAction("delete")}>
        Delete
      </div>
    </div>
  );
}
