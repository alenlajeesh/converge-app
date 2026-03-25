import { useEffect, useRef } from "react";
import MonacoEditor from "@monaco-editor/react";
import Tabs from "./Tabs";

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

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme("my-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#12121a",
      },
    });

    monaco.editor.setTheme("my-dark");

    editor.updateOptions({
      automaticLayout: true,
      scrollBeyondLastLine: false,
    });
  };

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

      {/* 🔥 FIXED WRAPPER */}
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
