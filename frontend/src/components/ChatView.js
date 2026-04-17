import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import "../styles/chatview.css";

export default function ChatView({ workspaceId }) {
  const { user, token } = useAuth();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ✅ CREATE SOCKET ONLY ONCE
  useEffect(() => {
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    // 🔥 LISTENER (ONLY ONCE)
    socket.on("receive-message", (msg) => {
      console.log("📩 Received:", msg);

      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // ✅ JOIN ROOM WHEN workspaceId CHANGES
  useEffect(() => {
    if (!workspaceId || !socketRef.current) return;

    console.log("📡 Joining workspace:", workspaceId);

    socketRef.current.emit("join-workspace", { workspaceId });

  }, [workspaceId]);

  // 📥 LOAD OLD MESSAGES
  useEffect(() => {
    if (!workspaceId || !token) return;

    fetch(`http://localhost:5000/api/chat/${workspaceId}`, {
      headers: {
        Authorization: "Bearer " + token,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          setMessages([]);
        }
      })
      .catch((err) => console.error(err));

  }, [workspaceId, token]);

  // 📤 SEND MESSAGE
  const sendMessage = () => {
    if (!message.trim()) return;
    if (!socketRef.current) return;

    socketRef.current.emit("send-message", {
      workspaceId,
      message,
    });

    setMessage("");
  };

  // 📜 AUTO SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Workspace Chat</h3>
        <span>
          {workspaceId
            ? `ID: ${workspaceId.slice(0, 6)}`
            : "No workspace"}
        </span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <p style={{ opacity: 0.5 }}>No messages yet...</p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${
              msg.userId?.toString() === user?._id ? "own" : ""
            }`}
          >
            <strong>{msg.username || "Unknown"}</strong>
            <p>{msg.message}</p>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
