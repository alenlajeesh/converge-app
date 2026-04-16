import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function ChatView({ workspaceId, username }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // 📥 Load old messages
  useEffect(() => {
    if (!workspaceId) return;

    fetch(`http://localhost:5000/api/chat/${workspaceId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data));
  }, [workspaceId]);

  // 🔌 Socket connection
  useEffect(() => {
    if (!workspaceId) return;

    socket.emit("join-workspace", { workspaceId, username });

    socket.on("receive-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("receive-message");
    };
  }, [workspaceId]);

  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-message", {
      workspaceId,
      message,
      username,
    });

    setMessage("");
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Workspace Chat</h3>
        <span>Code: {workspaceId?.slice(0, 6)}</span>
      </div>

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className="message">
            <strong>{msg.username}</strong>
            <p>{msg.message}</p>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
