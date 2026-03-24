import React from "react";
import "../styles/dashboard.css";

function Button({ children, variant = "primary", onClick }) {
  return (
    <button
      className={`btn ${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default Button;
