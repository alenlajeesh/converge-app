import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import * as api from "../api";
import { useTheme } from "../context/ThemeContext";
import "@xterm/xterm/css/xterm.css";

const XTERM_THEMES = {
  dark: {
    background: "#1e1e1e",
    foreground: "#cccccc",
    cursor: "#3794ff",
    cursorAccent: "#1e1e1e",
    selectionBackground: "#264f78",
    black: "#000000",
    red: "#f14c4c",
    green: "#89d185",
    yellow: "#cca700",
    blue: "#3794ff",
    magenta: "#d670d6",
    cyan: "#29b8db",
    white: "#e5e5e5",
    brightBlack: "#666666",
    brightRed: "#f14c4c",
    brightGreen: "#89d185",
    brightYellow: "#cca700",
    brightBlue: "#3794ff",
    brightMagenta: "#d670d6",
    brightCyan: "#29b8db",
    brightWhite: "#e5e5e5",
  },
  light: {
    background: "#ffffff",
    foreground: "#1e1e1e",
    cursor: "#0078d4",
    cursorAccent: "#ffffff",
    selectionBackground: "#add6ff",
    black: "#000000",
    red: "#cd3131",
    green: "#00bc00",
    yellow: "#949800",
    blue: "#0078d4",
    magenta: "#bc05bc",
    cyan: "#0598bc",
    white: "#555555",
    brightBlack: "#666666",
    brightRed: "#cd3131",
    brightGreen: "#14ce14",
    brightYellow: "#b5ba00",
    brightBlue: "#0078d4",
    brightMagenta: "#bc05bc",
    brightCyan: "#0598bc",
    brightWhite: "#a5a5a5",
  },
};

export default function Terminal({ id, rootPath }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const { theme } = useTheme();

  // Create the terminal + PTY session once per id/rootPath.
  useEffect(() => {
    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 12,
      theme: XTERM_THEMES[theme] || XTERM_THEMES.dark,
    });
    termRef.current = term;

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
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rootPath]);

  // Swap colors in place when the app theme changes — no PTY restart.
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = XTERM_THEMES[theme] || XTERM_THEMES.dark;
    }
  }, [theme]);

  return <div className="terminal-xterm-container" ref={containerRef} />;
}