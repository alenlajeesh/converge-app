import { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import Tabs from "./Tabs";
import { useTheme } from "../context/ThemeContext";

export default function Editor({
  selectedFile,
  content,
  setContent,
  openFiles,
  setActiveFile,
  closeFile,
  onSave,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const { theme } = useTheme();

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme("converge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#cccccc",
        "editorLineNumber.foreground": "#5a5a5a",
        "editorLineNumber.activeForeground": "#cccccc",
        "editor.selectionBackground": "#264f78",
        "editorCursor.foreground": "#3794ff",
        "editor.lineHighlightBackground": "#2a2a2a",
      },
    });

    monaco.editor.defineTheme("converge-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#1e1e1e",
        "editorLineNumber.foreground": "#a0a0a0",
        "editorLineNumber.activeForeground": "#1e1e1e",
        "editor.selectionBackground": "#add6ff",
        "editorCursor.foreground": "#0078d4",
        "editor.lineHighlightBackground": "#f3f3f3",
      },
    });

    monaco.editor.setTheme(theme === "light" ? "converge-light" : "converge-dark");

    editor.updateOptions({
      automaticLayout: true,
      scrollBeyondLastLine: false,
    });
  };

  // Switch the live editor's theme whenever the app theme changes —
  // handleEditorDidMount only runs once on mount, so this covers the
  // toggle case for an already-open editor.
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === "light" ? "converge-light" : "converge-dark");
    }
  }, [theme]);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (onSave) onSave();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);

  const getLanguage = () => {
    if (!selectedFile) return "plaintext";
    if (selectedFile.endsWith(".js")) return "javascript";
    if (selectedFile.endsWith(".json")) return "json";
    return "plaintext";
  };

  return (
    <div className="editor">
      <Tabs
        openFiles={openFiles}
        activeFile={selectedFile}
        setActiveFile={setActiveFile}
        closeFile={closeFile}
      />

      <div className="editor-content">
        {selectedFile ? (
          <MonacoEditor
            height="100%"
            language={getLanguage()}
            value={content}
            onChange={(value) => setContent(value || "")}
            onMount={handleEditorDidMount}
          />
        ) : (
          <div className="empty">Select a file</div>
        )}
      </div>
    </div>
  );
}