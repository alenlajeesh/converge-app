import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

export default function ChatView({ workspaceId }) {
  const { user, token } = useAuth();

  const [message,  setMessage]  = useState("");
  const [messages, setMessages] = useState([]);

  const socketRef    = useRef(null);
  const bottomRef    = useRef(null);

  // Init socket once
  useEffect(() => {
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("receive-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket error:", err.message);
    });

    return () => socket.disconnect();
  }, [token]);

  // Join room when workspaceId available
  useEffect(() => {
    if (!workspaceId || !socketRef.current) return;
    socketRef.current.emit("join-workspace", { workspaceId });
  }, [workspaceId, socketRef.current]);

  // Load history
  useEffect(() => {
    if (!workspaceId || !token) return;

    fetch(`http://localhost:5000/api/chat/${workspaceId}`, {
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

  const sendMessage = () => {
    if (!message.trim() || !socketRef.current) return;
    socketRef.current.emit("send-message", { workspaceId, message: message.trim() });
    setMessage("");
  };

  const isOwn = (msg) => {
    const msgUserId = msg.userId?._id || msg.userId;
    return msgUserId?.toString() === user?._id?.toString();
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Team Chat</h3>
        <span>{workspaceId ? `#${workspaceId.slice(-6)}` : "—"}</span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <p style={{ color: "#334155", fontSize: 13 }}>
            No messages yet. Say hi! 👋
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={msg._id || i} className={`message ${isOwn(msg) ? "own" : ""}`}>
            <strong>{msg.username || "Unknown"}</strong>
            <p>{msg.message}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Send a message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
