/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useCallback, useMemo } from "react";
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

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function TaskView({ workspaceId }) {
  const { user, token } = useAuth();

  const [tasks,    setTasks]    = useState([]);
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");

  const [filterMember,   setFilterMember]   = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy,         setSortBy]         = useState("newest");
  const [searchQuery,    setSearchQuery]    = useState("");

  const [form, setForm] = useState({
    title:        "",
    description:  "",
    assignedToId: "",
    priority:     "medium"
  });

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization:  "Bearer " + token
  }), [token]);

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
  }, [workspaceId, token, headers]);

  const loadMembers = useCallback(async () => {
    if (!workspaceId || !token) return;
    try {
      const r    = await fetch(`http://localhost:5000/api/tasks/${workspaceId}/members`, { headers });
      const data = await r.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadMembers:", e);
    }
  }, [workspaceId, token, headers]);

  useEffect(() => {
    loadTasks();
    loadMembers();
  }, [loadTasks, loadMembers]);

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

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.assignedToUsername?.toLowerCase().includes(q)
      );
    }

    if (filterMember !== "all") {
      result = result.filter((t) => t.assignedToUsername === filterMember);
    }

    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority);
    }

    result.sort((a, b) => {
      if (sortBy === "newest")   return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest")   return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (sortBy === "assignee") return a.assignedToUsername.localeCompare(b.assignedToUsername);
      return 0;
    });

    return result;
  }, [tasks, searchQuery, filterMember, filterPriority, sortBy]);

  const grouped = useMemo(() =>
    STATUSES.reduce((acc, s) => {
      acc[s] = filteredTasks.filter((t) => t.status === s);
      return acc;
    }, {}),
  [filteredTasks]);

  const isCreator = (task) =>
    task.assignedBy?.toString() === user?._id?.toString();

  const myTasksCount = tasks.filter(
    (t) => t.assignedToUsername === user?.username
  ).length;

  const activeFilters =
    (filterMember   !== "all" ? 1 : 0) +
    (filterPriority !== "all" ? 1 : 0) +
    (searchQuery.trim()       ? 1 : 0);

  const clearFilters = () => {
    setFilterMember("all");
    setFilterPriority("all");
    setSearchQuery("");
    setSortBy("newest");
  };

  return (
    <div className="task-container">
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

        <div className="task-stats">
          <div className="task-stats-header">Overview</div>
          <div className="task-stat-row">
            <span>Total</span>
            <span className="task-stat-val">{tasks.length}</span>
          </div>
          <div className="task-stat-row">
            <span>My Tasks</span>
            <span className="task-stat-val highlight">{myTasksCount}</span>
          </div>
          <div className="task-stat-row">
            <span className="dot-label pending">Pending</span>
            <span className="task-stat-val">
              {tasks.filter((t) => t.status === "pending").length}
            </span>
          </div>
          <div className="task-stat-row">
            <span className="dot-label inprogress">In Progress</span>
            <span className="task-stat-val">
              {tasks.filter((t) => t.status === "inprogress").length}
            </span>
          </div>
          <div className="task-stat-row">
            <span className="dot-label done">Done</span>
            <span className="task-stat-val">
              {tasks.filter((t) => t.status === "done").length}
            </span>
          </div>
        </div>
      </div>

      <div className="task-board">
        <div className="task-board-header">
          <div className="task-board-title-row">
            <h3>Task Board</h3>
            <span className="task-count">
              {filteredTasks.length} of {tasks.length}
            </span>
          </div>

          <div className="task-filter-bar">
            <div className="task-search-wrap">
              <span className="task-search-icon">🔍</span>
              <input
                className="task-search"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="task-search-clear"
                  onClick={() => setSearchQuery("")}
                >✕</button>
              )}
            </div>

            <select
              className="task-filter-select"
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m._id} value={m.username}>
                  {m.username === user?.username
                    ? `${m.username} (me)`
                    : m.username}
                </option>
              ))}
            </select>

            <select
              className="task-filter-select"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>

            <select
              className="task-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">↓ Newest</option>
              <option value="oldest">↑ Oldest</option>
              <option value="priority">⚡ Priority</option>
              <option value="assignee">👤 Assignee</option>
            </select>

            {activeFilters > 0 && (
              <button className="task-clear-btn" onClick={clearFilters}>
                Clear ({activeFilters})
              </button>
            )}
          </div>

          <div className="task-quick-filters">
            <button
              className={`task-quick-btn ${
                filterMember === user?.username ? "active" : ""
              }`}
              onClick={() =>
                setFilterMember(
                  filterMember === user?.username ? "all" : user?.username
                )
              }
            >
              👤 My Tasks ({myTasksCount})
            </button>
            <button
              className={`task-quick-btn ${
                filterPriority === "high" ? "active" : ""
              }`}
              onClick={() =>
                setFilterPriority(filterPriority === "high" ? "all" : "high")
              }
            >
              🔴 High Priority (
                {tasks.filter((t) => t.priority === "high").length}
              )
            </button>
            <button
              className={`task-quick-btn ${
                sortBy === "priority" ? "active" : ""
              }`}
              onClick={() =>
                setSortBy(sortBy === "priority" ? "newest" : "priority")
              }
            >
              ⚡ Sort by Priority
            </button>
          </div>
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
                    <div className="task-empty">
                      {activeFilters > 0 ? "No matches" : "No tasks"}
                    </div>
                  )}

                  {grouped[status].map((task) => (
                    <div key={task._id} className="task-card">
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

                      <div className="task-card-title">{task.title}</div>
                      {task.description && (
                        <div className="task-card-desc">{task.description}</div>
                      )}

                      <div className="task-card-meta">
                        <span
                          className={`task-assignee ${
                            task.assignedToUsername === user?.username
                              ? "task-assignee-me"
                              : ""
                          }`}
                        >
                          👤 {task.assignedToUsername}
                          {task.assignedToUsername === user?.username && " (me)"}
                        </span>
                        <span>by {task.assignedByUsername}</span>
                      </div>

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
