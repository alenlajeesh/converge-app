import "../styles/callnotification.css";

export default function CallNotification({
  participants,
  workspaceId,
  onJoin,
  onDismiss,
  callType
}) {
  if (!participants || participants.length === 0) return null;

  const names = participants.map((p) => p.username).join(", ");

  return (
    <div className="call-notif">
      <div className="call-notif-icon">
        {callType === "video" ? "📹" : "📞"}
      </div>
      <div className="call-notif-info">
        <div className="call-notif-title">
          {callType === "video" ? "Video" : "Voice"} call in progress
        </div>
        <div className="call-notif-names">{names}</div>
      </div>
      <div className="call-notif-actions">
        <button className="call-notif-join" onClick={onJoin}>
          Join
        </button>
        <button className="call-notif-dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    </div>
  );
}
