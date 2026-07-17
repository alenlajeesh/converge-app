import { useState } from "react";

export default function TaskFormModal({ task, members, currentUser, onClose, onSubmit }) {
  const isEdit = Boolean(task);

  const [form, setForm] = useState({
    title:        task?.title || "",
    description:  task?.description || "",
    assignedToId: task?.assignedTo?.toString() || "",
    priority:     task?.priority || "medium"
  });
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }

    setSaving(true);
    const result = await onSubmit(form);
    setSaving(false);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <h3>{isEdit ? "Edit Task" : "New Task"}</h3>
          <button className="task-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="task-modal-body">
          {error && <div className="task-error">{error}</div>}

          <div className="task-field">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div className="task-field">
            <label>Description <span className="task-optional">(optional)</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add more details..."
              rows={4}
            />
          </div>

          <div className="task-field">
            <label>Assign To</label>
            <select
              value={form.assignedToId}
              onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
            >
              <option value="">Myself</option>
              {members
                .filter((m) => m._id !== currentUser?._id)
                .map((m) => (
                  <option key={m._id} value={m._id}>{m.username}</option>
                ))}
            </select>
          </div>

          <div className="task-field">
            <label>Priority</label>
            <div className="task-priority-row">
              {["low", "medium", "high"].map((p) => (
                <button
                  key={p}
                  className={`task-priority-btn ${p} ${form.priority === p ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, priority: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="task-modal-footer">
          <button className="task-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="task-create-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}