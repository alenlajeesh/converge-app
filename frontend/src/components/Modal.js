export default function Modal({ modalType, newName, setNewName, onConfirm, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{modalType === "rename" ? "Rename" : modalType === "file" ? "New File" : "New Folder"}</h3>

        <input value={newName} onChange={(e) => setNewName(e.target.value)} />

        <div className="modal-actions">
          <button onClick={onConfirm}>Confirm</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
