import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import Terminal from "./Terminal";

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `term-${Date.now()}-${idCounter}`;
}

const TerminalPanel = forwardRef(function TerminalPanel({ rootPath, onClose }, ref) {
  const [terminals, setTerminals] = useState(() => [{ id: nextId(), label: 1 }]);
  const [activeId, setActiveId]   = useState(() => terminals[0].id);
  const labelCounter = useRef(1);

  const addTerminal = useCallback(() => {
    labelCounter.current += 1;
    const id = nextId();
    setTerminals((prev) => [...prev, { id, label: labelCounter.current }]);
    setActiveId(id);
  }, []);

  useImperativeHandle(ref, () => ({ addTerminal }), [addTerminal]);

  const closeTerminal = useCallback((id) => {
    setTerminals((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        onClose(); // no terminals left → hide the whole panel
      } else {
        setActiveId((current) =>
          current === id ? remaining[remaining.length - 1].id : current
        );
      }
      return remaining;
    });
  }, [onClose]);

  return (
    <div className="terminal-panel">
      <div className="terminal-tabs">
        {terminals.map((t) => (
          <div
            key={t.id}
            className={`terminal-tab ${t.id === activeId ? "active" : ""}`}
            onClick={() => setActiveId(t.id)}
          >
            <span>Shell {t.label}</span>
            <button
              className="terminal-tab-close"
              onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
              title="Close this terminal"
            >
              ✕
            </button>
          </div>
        ))}

        <button className="terminal-tab-add" onClick={addTerminal} title="New Terminal">
          +
        </button>

        <div className="terminal-tabs-spacer" />

        <button className="terminal-panel-close" onClick={onClose} title="Hide terminal panel">
          ✕
        </button>
      </div>

      <div className="terminal-instances">
        {terminals.map((t) => (
          <div
            key={t.id}
            className="terminal-instance-slot"
            style={{ display: t.id === activeId ? "flex" : "none" }}
          >
            <Terminal id={t.id} rootPath={rootPath} />
          </div>
        ))}
      </div>
    </div>
  );
});

export default TerminalPanel;