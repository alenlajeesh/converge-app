import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/taskview.css";

const STATUSES = ["pending", "inprogress", "done"];

const STATUS_LABEL = {
  pending:    "Pending",
  inprogress: "In Progress",
  done:       "Done"
};

const STATUS_NEXT = {
  pending:    "inprogress",
  inprogress: "done",
  done:       "pending"
};

const PRIORITY_COLOR = {
  low:    "priority-low",
  medium: "priority-medium",
  high:   "priority-high"
};

export default function TaskView({ workspaceId }) {
  const { user, token } = useAuth();

  const [tasks,    setTasks]    = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");

  // Form state
  const [form, setForm] = useState({
    title:        "",
    description:  "",
    assignedToId: "",
    priority:     "medium"
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization:  "Bearer " + token
  };

  // ── Load tasks ───────────────────────────
  const loadTasks = useCallback(async () => {
    if (!workspaceId || !token) return;
    setLoading(true);
    try {
      const r    = await fetch(`http://localhost:5000/api/tasks/${workspaceId}`, { headers });
      const data = await r.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadTasks:", e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token]);

  // ── Load members for dropdown ────────────
  const loadMembers = useCallback(async () => {
    if (!workspaceId || !token) return;
    try {
      const r    = await fetch(`http://localhost:5000/api/tasks/${workspaceId}/members`, { headers });
      const data = await r.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadMembers:", e);
    }
  }, [workspaceId, token]);

  useEffect(() => {
    loadTasks();
    loadMembers();
  }, [loadTasks, loadMembers]);

  // ── Create task ──────────────────────────
  const handleCreate = async () => {
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }

    setCreating(true);
    try {
      const r = await fetch("http://localhost:5000/api/tasks", {
        method:  "POST",
        headers,
        body:    JSON.stringify({ ...form, workspaceId })
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || "Failed to create task"); return; }

      setTasks((prev) => [data, ...prev]);
      setForm({ title: "", description: "", assignedToId: "", priority: "medium" });
    } catch (e) {
      setError("Server error");
    } finally {
      setCreating(false);
    }
  };

  // ── Update status ────────────────────────
  const handleStatusChange = async (task, newStatus) => {
    try {
      const r = await fetch(`http://localhost:5000/api/tasks/${task._id}/status`, {
        method:  "PATCH",
        headers,
        body:    JSON.stringify({ status: newStatus })
      });
      const data = await r.json();
      if (!r.ok) return;
      setTasks((prev) => prev.map((t) => t._id === data._id ? data : t));
    } catch (e) {
      console.error("updateStatus:", e);
    }
  };

  // ── Delete task ──────────────────────────
  const handleDelete = async (taskId) => {
    try {
      const r = await fetch(`http://localhost:5000/api/tasks/${taskId}`, {
        method: "DELETE",
        headers
      });
      if (!r.ok) return;
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (e) {
      console.error("deleteTask:", e);
    }
  };

  // ── Group tasks by status ────────────────
  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  const isCreator = (task) =>
    task.assignedBy?.toString() === user?._id?.toString();

  return (
    <div className="task-container">
      {/* ── LEFT: Create Form ── */}
      <div className="task-sidebar">
        <div className="task-sidebar-header">
          <h3>New Task</h3>
        </div>

        <div className="task-form">
          {error && <div className="task-error">{error}</div>}

          <div className="task-field">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="task-field">
            <label>Description <span className="task-optional">(optional)</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add more details..."
              rows={3}
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
                .filter((m) => m._id !== user?._id)
                .map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.username}
                  </option>
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

          <button
            className="task-create-btn"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating..." : "+ Create Task"}
          </button>
        </div>
      </div>

      {/* ── RIGHT: Board ── */}
      <div className="task-board">
        <div className="task-board-header">
          <h3>Task Board</h3>
          <span className="task-count">{tasks.length} total</span>
        </div>

        {loading ? (
          <div className="task-loading">Loading tasks...</div>
        ) : (
          <div className="task-columns">
            {STATUSES.map((status) => (
              <div key={status} className={`task-column task-col-${status}`}>
                <div className="task-column-header">
                  <span className={`task-col-dot dot-${status}`} />
                  <span className="task-col-title">{STATUS_LABEL[status]}</span>
                  <span className="task-col-count">{grouped[status].length}</span>
                </div>

                <div className="task-cards">
                  {grouped[status].length === 0 && (
                    <div className="task-empty">No tasks</div>
                  )}

                  {grouped[status].map((task) => (
                    <div key={task._id} className="task-card">
                      {/* Priority + delete */}
                      <div className="task-card-top">
                        <span className={`task-badge ${PRIORITY_COLOR[task.priority]}`}>
                          {task.priority}
                        </span>
                        {isCreator(task) && (
                          <button
                            className="task-delete-btn"
                            onClick={() => handleDelete(task._id)}
                            title="Delete task"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Title + desc */}
                      <div className="task-card-title">{task.title}</div>
                      {task.description && (
                        <div className="task-card-desc">{task.description}</div>
                      )}

                      {/* Meta */}
                      <div className="task-card-meta">
                        <span>👤 {task.assignedToUsername}</span>
                        <span>by {task.assignedByUsername}</span>
                      </div>

                      {/* Status toggle */}
                      <button
                        className={`task-status-btn status-${task.status}`}
                        onClick={() =>
                          handleStatusChange(task, STATUS_NEXT[task.status])
                        }
                      >
                        {task.status === "pending"    && "▶ Start"}
                        {task.status === "inprogress" && "✓ Mark Done"}
                        {task.status === "done"       && "↺ Reopen"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
