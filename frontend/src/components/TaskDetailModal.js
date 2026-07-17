import { useEffect, useState, useCallback } from "react";

const STATUS_LABEL = { pending: "Pending", inprogress: "In Progress", done: "Done" };
const STATUS_NEXT  = { pending: "inprogress", inprogress: "done", done: "pending" };

export default function TaskDetailModal({
  task, apiUrl, headers,
  canEdit, onClose, onEdit, onDelete, onStatusChange, onCommentAdded
}) {
  const [comments, setComments] = useState(task.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const r = await fetch(`${apiUrl}/api/tasks/${task._id}/comments`, { headers });
      const data = await r.json();
      if (r.ok) setComments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("loadComments:", e);
    } finally {
      setLoadingComments(false);
    }
  }, [apiUrl, headers, task._id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleReply = async () => {
    setError("");
    if (!replyBody.trim()) return;

    setPosting(true);
    try {
      const r = await fetch(`${apiUrl}/api/tasks/${task._id}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: replyBody.trim() })
      });
      const data = await r.json();
      if (!r.ok) { setError(data.message || "Failed to post reply"); return; }
      setComments((prev) => [...prev, data]);
      onCommentAdded(data);
      setReplyBody("");
    } catch (e) {
      setError("Server error");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="task-modal-overlay" onClick={onClose}>
      <div className="task-modal task-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-header">
          <div className="task-detail-title-row">
            <span className={`task-badge priority-${task.priority}`}>{task.priority}</span>
            <h3>{task.title}</h3>
          </div>
          <button className="task-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="task-modal-body">
          {task.description && <p className="task-detail-desc">{task.description}</p>}

          <div className="task-detail-meta">
            <span>Assigned to <strong>{task.assignedToUsername}</strong></span>
            <span>Created by <strong>{task.assignedByUsername}</strong></span>
          </div>

          <div className="task-detail-actions">
            <button
              className={`task-status-btn status-${task.status}`}
              onClick={() => onStatusChange(STATUS_NEXT[task.status])}
            >
              {task.status === "pending"    && "Start"}
              {task.status === "inprogress" && "Mark Done"}
              {task.status === "done"       && "Reopen"}
            </button>
            <span className="task-detail-status-label">{STATUS_LABEL[task.status]}</span>

            {canEdit && (
              <div className="task-detail-owner-actions">
                <button className="task-edit-btn" onClick={onEdit}>Edit</button>
                <button className="task-delete-text-btn" onClick={onDelete}>Delete</button>
              </div>
            )}
          </div>

          <div className="task-comments-section">
            <div className="task-comments-header">
              {comments.length} {comments.length === 1 ? "Reply" : "Replies"}
            </div>

            {loadingComments ? (
              <div className="task-comments-loading">Loading replies...</div>
            ) : (
              <div className="task-comments">
                {comments.length === 0 && (
                  <div className="task-empty">No replies yet</div>
                )}
                {comments.map((c) => (
                  <div key={c._id} className="task-comment">
                    <div className="task-comment-header">
                      <span className="task-comment-author">{c.authorUsername}</span>
                      <span className="task-comment-time">
                        {new Date(c.createdAt).toLocaleString(undefined, {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <div className="task-comment-body">{c.body}</div>
                  </div>
                ))}
              </div>
            )}

            {error && <div className="task-error">{error}</div>}

            <div className="task-reply-box">
              <textarea
                className="task-reply-input"
                placeholder="Write a reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply();
                }}
              />
              <button
                className="task-reply-btn"
                onClick={handleReply}
                disabled={posting || !replyBody.trim()}
              >
                {posting ? "Posting..." : "Reply"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}