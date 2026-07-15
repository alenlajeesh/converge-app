import { useEffect } from "react";
import "../styles/notifications.css";

export default function NotificationToast({ toast, onJoin, onDismiss }) {
  const { id, type, callType, participants, username, message } = toast;

  // Chat toasts auto-dismiss; call toasts stay until joined/dismissed.
  useEffect(() => {
    if (type !== "chat") return;
    const timer = setTimeout(() => onDismiss(id), 5000);
    return () => clearTimeout(timer);
  }, [type, id, onDismiss]);

  if (type === "call") {
    const names = participants.map((p) => p.username).join(", ");
    return (
      <div className="toast toast-call">
        <div className="toast-icon">{callType === "video" ? "📹" : "📞"}</div>
        <div className="toast-body">
          <div className="toast-title">
            {callType === "video" ? "Video" : "Voice"} call in progress
          </div>
          <div className="toast-sub">{names}</div>
        </div>
        <div className="toast-actions">
          <button className="toast-btn toast-btn-primary" onClick={() => onJoin(toast)}>
            Join
          </button>
          <button className="toast-btn-close" onClick={() => onDismiss(id)}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className="toast toast-chat" onClick={() => onDismiss(id)}>
      <div className="toast-icon">💬</div>
      <div className="toast-body">
        <div className="toast-title">{username}</div>
        <div className="toast-sub toast-message">{message}</div>
      </div>
      <button
        className="toast-btn-close"
        onClick={(e) => { e.stopPropagation(); onDismiss(id); }}
      >
        ✕
      </button>
    </div>
  );
}