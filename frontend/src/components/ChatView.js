export default function ChatView() {
  return (
    <div className="view">
      <h2>Welcome to Chat</h2>
      <div className="chat-box">
        <div className="messages"></div>
        <input placeholder="Type a message..." />
      </div>
    </div>
  );
}
