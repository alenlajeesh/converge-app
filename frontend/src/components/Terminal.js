import { useState, useRef, useEffect } from "react";
import * as api from "../api";

export default function Terminal({ rootPath, onClose }) {
  const [history, setHistory] = useState([
    "Terminal Shell",
  ]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const outputRef = useRef(null);

  // 🔥 Auto scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop =
        outputRef.current.scrollHeight;
    }
  }, [history]);

  // 🚀 Run command
  const runCommand = async () => {
    if (!input.trim()) return;

    const command = input;

    // Save command history
    setCommandHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    setHistory((prev) => [...prev, `$ ${command}`]);
    setInput("");

    try {
      const result = await api.runCommand(
        command,
        rootPath
      );

      setHistory((prev) => [
        ...prev,
        result || "(no output)",
      ]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        "Error executing command",
      ]);
    }
  };

  // ⌨️ Handle keys
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      runCommand();
    }

    if (e.key === "ArrowUp") {
      if (commandHistory.length === 0) return;

      const newIndex =
        historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);

      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
    }

    if (e.key === "ArrowDown") {
      if (commandHistory.length === 0) return;

      if (historyIndex === -1) return;

      const newIndex = Math.min(
        commandHistory.length - 1,
        historyIndex + 1
      );

      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
    }
  };

  return (
    <div className="terminal">
      {/* 🔝 HEADER */}
      <div className="terminal-header">
        <span>TERMINAL</span>

        <button
          className="terminal-close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* 📤 OUTPUT */}
      <div className="terminal-output" ref={outputRef}>
        {history.map((line, i) => (
          <div key={i} className="terminal-line">
            {line}
          </div>
        ))}
      </div>

      {/* ⌨️ INPUT */}
      <div className="terminal-input">
        <span>$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          autoFocus
        />
      </div>
    </div>
  );
}
