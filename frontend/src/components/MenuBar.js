import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "../styles/menubar.css";

const MENU_ITEMS = ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"];

function MenuBar() {
  const [openMenu, setOpenMenu] = useState(null);
  const [autostartOn, setAutostartOn] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    invoke("get_autostart")
      .then(setAutostartOn)
      .catch((err) => console.error("get_autostart error:", err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (item) => {
    setOpenMenu((current) => (current === item ? null : item));
  };

  const handleNewTerminal = () => {
    window.dispatchEvent(new CustomEvent("converge:new-terminal"));
    setOpenMenu(null);
  };

  const toggleAutostart = async () => {
    try {
      const next = !autostartOn;
      await invoke("set_autostart", { enabled: next });
      setAutostartOn(next);
    } catch (err) {
      console.error("set_autostart error:", err);
    }
    setOpenMenu(null);
  };

  const handleQuit = async () => {
    setOpenMenu(null);
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.error("quit error:", err);
    }
  };

  return (
    <div className="menubar" ref={wrapperRef}>
      <div className="menubar-left">
        {MENU_ITEMS.map((item) => (
          <div key={item} className="menubar-item-wrapper">
            <span
              className={`menubar-item ${openMenu === item ? "active" : ""}`}
              onClick={() => handleItemClick(item)}
            >
              {item}
            </span>

            {item === "File" && openMenu === "File" && (
              <div className="menubar-dropdown">
                <div className="menubar-dropdown-item" onClick={toggleAutostart}>
                  <span>Autostart</span>
                  <span className="menubar-dropdown-check">
                    {autostartOn ? "✓" : ""}
                  </span>
                </div>
                <div className="menubar-dropdown-divider" />
                <div className="menubar-dropdown-item" onClick={handleQuit}>
                  <span>Quit</span>
                </div>
              </div>
            )}

            {item === "Terminal" && openMenu === "Terminal" && (
              <div className="menubar-dropdown">
                <div className="menubar-dropdown-item" onClick={handleNewTerminal}>
                  New Terminal
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MenuBar;