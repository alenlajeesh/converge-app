import { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
const apiUrl = process.env.REACT_APP_API_URL;
export default function ChatView({ workspaceId }) {
  const { user, token } = useAuth();

  const [message,   setMessage]   = useState("");
  const [messages,  setMessages]  = useState([]);
  const [connected, setConnected] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const joinedRef = useRef(null);

  // Init socket
  useEffect(() => {
    if (!token) return;

    const socket = io(`${apiUrl}`, {
      auth:              { token },
      reconnection:      true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      if (joinedRef.current) {
        socket.emit("join-workspace", { workspaceId: joinedRef.current });
      }
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("receive-message", (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("message-deleted", ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = null;
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Join room
  useEffect(() => {
    if (!workspaceId || !socketRef.current) return;
    if (joinedRef.current === workspaceId) return;

    socketRef.current.emit("join-workspace", { workspaceId });
    joinedRef.current = workspaceId;
    setMessages([]);
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load history
  useEffect(() => {
    if (!workspaceId || !token) return;

    fetch(`${apiUrl}/api/chat/${workspaceId}`, {
      headers: { Authorization: "Bearer " + token }
    })
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [workspaceId, token]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send
  const sendMessage = useCallback(() => {
    if (!message.trim() || !socketRef.current || !workspaceId) return;
    socketRef.current.emit("send-message", {
      workspaceId,
      message: message.trim()
    });
    setMessage("");
  }, [message, workspaceId,apiUrl]);

  // Delete
  const deleteMessage = useCallback((msg) => {
    if (!socketRef.current) return;
    setMessages((prev) => prev.filter((m) => m._id !== msg._id));
    socketRef.current.emit("delete-message", {
      messageId:   msg._id,
      workspaceId
    });
  }, [workspaceId]);

  const isOwn = (msg) => {
    const msgUserId = msg.userId?._id || msg.userId;
    return msgUserId?.toString() === user?._id?.toString();
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Team Chat</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width:        7,
            height:       7,
            borderRadius: "50%",
            background:   connected ? "#4ade80" : "#f87171",
            display:      "inline-block",
            flexShrink:   0
          }} />
          <span>{workspaceId ? `#${workspaceId.slice(-6)}` : "—"}</span>
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <p style={{ color: "#334155", fontSize: 13 }}>
            No messages yet. Say hi! 👋
          </p>
        )}

        {messages.map((msg, i) => {
          const own = isOwn(msg);
          return (
            <div
              key={msg._id || i}
              className={`message ${own ? "own" : ""}`}
              onMouseEnter={() => setHoveredId(msg._id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ position: "relative" }}
            >
              <strong>{msg.username || "Unknown"}</strong>
              <p>{msg.message}</p>

              {own && hoveredId === msg._id && (
                <button
                  className="msg-delete-btn"
                  onClick={() => deleteMessage(msg)}
                  title="Delete message"
                >
                  🗑️
                </button>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={connected ? "Send a message..." : "Connecting..."}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={!connected}
        />
        <button onClick={sendMessage} disabled={!connected}>
          Send
        </button>
      </div>
    </div>
  );
}
