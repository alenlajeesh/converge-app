import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: ""
  });

  const handleSubmit = async () => {
    const url = isLogin
      ? "http://localhost:5000/api/auth/login"
      : "http://localhost:5000/api/auth/register";

    const body = isLogin
      ? { email: form.email, password: form.password }
      : form;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!data.token) {
      alert(data.message || "Error");
      return;
    }

    login(data.token, data.user);
    navigate("/");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-header">
          <h2 className="auth-title">
            {isLogin ? "Login" : "Register"}
          </h2>

          <button className="auth-back" onClick={() => navigate("/")}>
            ← Back
          </button>
        </div>

        {!isLogin && (
          <div className="auth-group">
            <input
              placeholder="Username"
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
            />
          </div>
        )}

        <div className="auth-group">
          <input
            placeholder="Email"
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />
        </div>

        <div className="auth-group">
          <input
            type="password"
            placeholder="Password"
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />
        </div>

        <button className="auth-btn" onClick={handleSubmit}>
          {isLogin ? "Login" : "Register"}
        </button>

        <p
          className="auth-switch"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Create account" : "Already have an account?"}
        </p>

      </div>
    </div>
  );
}

export default AuthPage;
