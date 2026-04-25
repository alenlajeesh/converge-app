import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

function AuthPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const apiUrl = process.env.REACT_APP_API_URL;
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({
    username: "",
    email:    "",
    password: ""
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setError("");

    if (!form.email || !form.password) {
      setError("Email and password are required");
      return;
    }
    if (!isLogin && !form.username) {
      setError("Username is required");
      return;
    }

    setLoading(true);
    try {
      const url  = isLogin
        ? `${apiUrl}/api/auth/login`
        : `${apiUrl}/api/auth/register`;

      const body = isLogin
        ? { email: form.email, password: form.password }
        : { username: form.username, email: form.email, password: form.password };

      const res  = await fetch(url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok || !data.token) {
        setError(data.message || "Something went wrong");
        return;
      }

      login(data.token, data.user);
      navigate("/");
    } catch (err) {
      setError("Server error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">{isLogin ? "Welcome back" : "Create account"}</h2>
          <button className="auth-back" onClick={() => navigate("/")}>← Back</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {!isLogin && (
          <div className="auth-group">
            <label>Username</label>
            <input
              name="username"
              placeholder="Your username"
              value={form.username}
              onChange={handleChange}
            />
          </div>
        )}

        <div className="auth-group">
          <label>Email</label>
          <input
            name="email"
            type="email"
            placeholder="you@email.com"
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div className="auth-group">
          <label>Password</label>
          <input
            name="password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <button
          className="auth-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
        </button>

        <p className="auth-switch" onClick={() => { setIsLogin(!isLogin); setError(""); }}>
          {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
        </p>
      </div>
    </div>
  );
}

export default AuthPage;
