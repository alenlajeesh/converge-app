import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import TaskFormModal from "./TaskFormModal";
import TaskDetailModal from "./TaskDetailModal";
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
  const apiUrl = process.env.REACT_APP_API_URL;

  const [tasks,   setTasks]   = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [scope,          setScope]          = useState("mine"); // "mine" | "all"
  const [searchQuery,    setSearchQuery]    = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy,         setSortBy]         = useState("newest");

  const [showForm,    setShowForm]    = useState(false); // create/edit modal
  const [editingTask, setEditingTask] = useState(null);  // null = create mode
  const [detailTask,  setDetailTask]  = useState(null);  // task open in detail modal

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization:  "Bearer " + token
  }), [token]);

  const loadTasks = useCallback(async () => {
    if (!workspaceId || !token) return;
    setLoading(true);
    try {
      const r    = await fetch(`${apiUrl}/api/tasks/${workspaceId}`, { headers });
      const data = await r.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadTasks:", e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token, headers, apiUrl]);

  const loadMembers = useCallback(async () => {
    if (!workspaceId || !token) return;
    try {
      const r    = await fetch(`${apiUrl}/api/tasks/${workspaceId}/members`, { headers });
      const data = await r.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadMembers:", e);
    }
  }, [workspaceId, token, headers, apiUrl]);

  useEffect(() => {
    loadTasks();
    loadMembers();
  }, [loadTasks, loadMembers]);

  // ── create / edit (shared modal) ──────────────
  const openCreate = () => { setEditingTask(null); setShowForm(true); };
  const openEdit = (task) => { setDetailTask(null); setEditingTask(task); setShowForm(true); };

  const handleFormSubmit = async (formValues) => {
    const isEdit = Boolean(editingTask);
    const url    = isEdit ? `${apiUrl}/api/tasks/${editingTask._id}` : `${apiUrl}/api/tasks`;
    const method = isEdit ? "PATCH" : "POST";
    const body   = isEdit ? formValues : { ...formValues, workspaceId };

    const r = await fetch(url, { method, headers, body: JSON.stringify(body) });
    const data = await r.json();
    if (!r.ok) return { error: data.message || "Something went wrong" };

    setTasks((prev) =>
      isEdit ? prev.map((t) => (t._id === data._id ? data : t)) : [data, ...prev]
    );
    setShowForm(false);
    setEditingTask(null);
    return { error: null };
  };

  // ── status / delete ───────────────────────────
  const handleStatusChange = async (task, newStatus) => {
    try {
      const r = await fetch(`${apiUrl}/api/tasks/${task._id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      const data = await r.json();
      if (!r.ok) return;
      setTasks((prev) => prev.map((t) => (t._id === data._id ? data : t)));
      setDetailTask((prev) => (prev && prev._id === data._id ? data : prev));
    } catch (e) {
      console.error("updateStatus:", e);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      const r = await fetch(`${apiUrl}/api/tasks/${taskId}`, { method: "DELETE", headers });
      if (!r.ok) return;
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      setDetailTask((prev) => (prev && prev._id === taskId ? null : prev));
    } catch (e) {
      console.error("deleteTask:", e);
    }
  };

  // ── comments (used by detail modal) ───────────
  const handleCommentAdded = (taskId, comment) => {
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, comments: [...(t.comments || []), comment] } : t))
    );
    setDetailTask((prev) =>
      prev && prev._id === taskId ? { ...prev, comments: [...(prev.comments || []), comment] } : prev
    );
  };

  const handleCommentDeleted = (taskId, commentId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, comments: (t.comments || []).filter((c) => c._id !== commentId) }
          : t
      )
    );
    setDetailTask((prev) =>
      prev && prev._id === taskId
        ? { ...prev, comments: (prev.comments || []).filter((c) => c._id !== commentId) }
        : prev
    );
  };

  const isCreator = (task) => task.assignedBy?.toString() === user?._id?.toString();

  // ── derived lists ──────────────────────────────
  const scopedTasks = useMemo(() => {
    if (scope === "mine") {
      return tasks.filter((t) => t.assignedToUsername === user?.username);
    }
    return tasks;
  }, [tasks, scope, user]);

  const filteredTasks = useMemo(() => {
    let result = [...scopedTasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assignedToUsername?.toLowerCase().includes(q)
      );
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
  }, [scopedTasks, searchQuery, filterPriority, sortBy]);

  const grouped = useMemo(
    () =>
      STATUSES.reduce((acc, s) => {
        acc[s] = filteredTasks.filter((t) => t.status === s);
        return acc;
      }, {}),
    [filteredTasks]
  );

  const activeFilters = (filterPriority !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);
  const clearFilters = () => {
    setFilterPriority("all");
    setSearchQuery("");
    setSortBy("newest");
  };

  return (
    <div className="task-container">
      <div className="task-board">
        <div className="task-board-header">
          <div className="task-tabs">
            <button
              className={`task-tab ${scope === "mine" ? "active" : ""}`}
              onClick={() => setScope("mine")}
            >
              My Tasks
            </button>
            <button
              className={`task-tab ${scope === "all" ? "active" : ""}`}
              onClick={() => setScope("all")}
            >
              All Tasks
            </button>
            <span className="task-count">
              {filteredTasks.length} of {scopedTasks.length}
            </span>
            <button className="task-new-btn" onClick={openCreate}>
              + New Task
            </button>
          </div>

          <div className="task-filter-bar">
            <div className="task-search-wrap">
              <svg className="task-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" />
              </svg>
              <input
                className="task-search"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="task-search-clear" onClick={() => setSearchQuery("")}>
                  ×
                </button>
              )}
            </div>

            <select
              className="task-filter-select"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="task-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="priority">Priority</option>
              <option value="assignee">Assignee</option>
            </select>

            {activeFilters > 0 && (
              <button className="task-clear-btn" onClick={clearFilters}>
                Clear ({activeFilters})
              </button>
            )}
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
                    <div className="task-empty">{activeFilters > 0 ? "No matches" : "No tasks"}</div>
                  )}

                  {grouped[status].map((task) => (
                    <div
                      key={task._id}
                      className="task-card"
                      onClick={() => setDetailTask(task)}
                    >
                      <div className="task-card-top">
                        <span className={`task-badge ${PRIORITY_COLOR[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>

                      <div className="task-card-title">{task.title}</div>

                      <div className="task-card-meta">
                        <span
                          className={
                            task.assignedToUsername === user?.username
                              ? "task-assignee task-assignee-me"
                              : "task-assignee"
                          }
                        >
                          {task.assignedToUsername}
                          {task.assignedToUsername === user?.username && " (me)"}
                        </span>
                        {task.comments?.length > 0 && (
                          <span className="task-comment-count">
                            {task.comments.length} {task.comments.length === 1 ? "reply" : "replies"}
                          </span>
                        )}
                      </div>

                      <button
                        className={`task-status-btn status-${task.status}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(task, STATUS_NEXT[task.status]);
                        }}
                      >
                        {task.status === "pending"    && "Start"}
                        {task.status === "inprogress" && "Mark Done"}
                        {task.status === "done"       && "Reopen"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <TaskFormModal
          task={editingTask}
          members={members}
          currentUser={user}
          onClose={() => { setShowForm(false); setEditingTask(null); }}
          onSubmit={handleFormSubmit}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          apiUrl={apiUrl}
          headers={headers}
          currentUser={user}
          canEdit={isCreator(detailTask)}
          onClose={() => setDetailTask(null)}
          onEdit={() => openEdit(detailTask)}
          onDelete={() => handleDelete(detailTask._id)}
          onStatusChange={(status) => handleStatusChange(detailTask, status)}
          onCommentAdded={(comment) => handleCommentAdded(detailTask._id, comment)}
          onCommentDeleted={(commentId) => handleCommentDeleted(detailTask._id, commentId)}
        />
      )}
    </div>
  );
}