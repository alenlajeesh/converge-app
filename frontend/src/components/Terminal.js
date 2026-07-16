import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import * as api from "../api";
import "@xterm/xterm/css/xterm.css";

export default function Terminal({ id, rootPath }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 12,
      theme: {
        background: "#020617",
        foreground: "#e2e8f0",
        cursor: "#3b82f6",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    let unlistenOutput;
    let unlistenClosed;
    let cancelled = false;

    (async () => {
      try {
        await api.createPtySession(id, rootPath);
      } catch (err) {
        term.write(`\r\nFailed to start shell: ${err}\r\n`);
        return;
      }
      if (cancelled) return;

      api.resizePty(id, term.rows, term.cols).catch(() => {});

      unlistenOutput = await listen(`pty-output-${id}`, (event) => {
        term.write(event.payload);
      });
      unlistenClosed = await listen(`pty-closed-${id}`, () => {
        term.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
      });
    })();

    const dataDisposable = term.onData((data) => {
      api.writeToPty(id, data).catch(() => {});
    });

    const doFit = () => {
      fitAddon.fit();
      api.resizePty(id, term.rows, term.cols).catch(() => {});
    };

    const resizeObserver = new ResizeObserver(doFit);
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      if (unlistenOutput) unlistenOutput();
      if (unlistenClosed) unlistenClosed();
      api.closePtySession(id).catch(() => {});
      term.dispose();
    };
  }, [id, rootPath]);

  return <div className="terminal-xterm-container" ref={containerRef} />;
}