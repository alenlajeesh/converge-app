import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke("get_theme")
      .then((t) => {
        setThemeState(t);
        document.documentElement.setAttribute("data-theme", t);
      })
      .catch((err) => console.error("get_theme error:", err))
      .finally(() => setLoaded(true));
  }, []);

  const setTheme = useCallback(async (next) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      await invoke("set_theme", { theme: next });
    } catch (err) {
      console.error("set_theme error:", err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      invoke("set_theme", { theme: next }).catch((err) =>
        console.error("set_theme error:", err)
      );
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}