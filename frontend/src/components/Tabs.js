export default function Tabs({ openFiles, activeFile, setActiveFile, closeFile }) {
  return (
    <div className="tabs">
      {openFiles.map((file) => (
        <div
          key={file}
          className={`tab ${activeFile === file ? "active" : ""}`}
          onClick={() => setActiveFile(file)}
        >
          {file.split("/").pop()}
          <span
            className="close"
            onClick={(e) => {
              e.stopPropagation();
              closeFile(file);
            }}
          >
            ✕
          </span>
        </div>
      ))}
    </div>
  );
}
