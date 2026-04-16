import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    if (token) {
      fetch("http://localhost:5000/api/auth/me", {
        headers: {
          Authorization: "Bearer " + token
        }
      })
        .then(res => res.json())
        .then(data => setUser(data))
        .catch(() => logout());
    }
  }, [token]);

  const login = (token, user) => {
    localStorage.setItem("token", token);
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
