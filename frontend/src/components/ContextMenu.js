import { useEffect, useRef, useState } from "react";

export default function ContextMenu({
  x, y, visible, node,
  onClose, onAction, onRename, onDelete
}) {
  const menuRef = useRef(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const t = setTimeout(() => window.addEventListener("mousedown", handle), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", handle);
    };
  }, [visible, onClose]);

  const fire = (e, action) => {
    e.stopPropagation();
    e.preventDefault();

    if (action === "rename") {
      onClose();
      setModal({ type: "rename", defaultValue: node?.name || "" });
      return;
    }

    if (action === "delete") {
      onClose();
      setModal({
        type:    "confirm",
        message: `Delete "${node?.name}"? This cannot be undone.`
      });
      return;
    }

    // ✅ For newFile / newFolder:
    // call onAction WITH the node directly so WorkspaceHome
    // doesn't have to read from stale contextMenu state
    onClose();
    onAction(action, node);
  };

  return (
    <>
      {visible && (
        <div
          className="context-menu"
          ref={menuRef}
          style={{
            top:  Math.min(y, window.innerHeight - 175),
            left: Math.min(x, window.innerWidth  - 165),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item"
            onMouseDown={(e) => fire(e, "newFile")}>
            📄 New File
          </div>
          <div className="context-menu-item"
            onMouseDown={(e) => fire(e, "newFolder")}>
            📁 New Folder
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item"
            onMouseDown={(e) => fire(e, "rename")}>
            ✏️ Rename
          </div>
          <div className="context-menu-item danger"
            onMouseDown={(e) => fire(e, "delete")}>
            🗑️ Delete
          </div>
        </div>
      )}

      {modal && (
        <ContextModal
          modal={modal}
          onClose={() => setModal(null)}
          onRename={(newName) => {
            setModal(null);
            if (newName && newName !== node?.name) onRename(node, newName);
          }}
          onDelete={() => {
            setModal(null);
            onDelete(node);
          }}
        />
      )}
    </>
  );
}

function ContextModal({ modal, onClose, onRename, onDelete }) {
  const [value, setValue] = useState(modal.defaultValue || "");

  return (
    <div className="cm-modal-overlay" onMouseDown={onClose}>
      <div className="cm-modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="cm-modal-title">
          {modal.type === "rename" ? "✏️ Rename" : "🗑️ Confirm Delete"}
        </h3>

        {modal.type === "rename" && (
          <input
            className="cm-modal-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  onRename(value);
              if (e.key === "Escape") onClose();
            }}
            autoFocus
          />
        )}

        {modal.type === "confirm" && (
          <p className="cm-modal-message">{modal.message}</p>
        )}

        <div className="cm-modal-actions">
          {modal.type === "rename" && (
            <button className="cm-btn cm-btn-primary"
              onClick={() => onRename(value)}>
              Rename
            </button>
          )}
          {modal.type === "confirm" && (
            <button className="cm-btn cm-btn-danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="cm-btn cm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
