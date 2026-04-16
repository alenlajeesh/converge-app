const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ message: "No token" });
    }

    const token = header.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    console.log("🔍 AUTH DECODED:", decoded);

    // ✅ FIXED HERE (id not userId)
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ✅ CLEAN USER OBJECT
    req.user = {
      id: user._id.toString(),
      username: user.username,
    };

    next();

  } catch (err) {
    console.error("❌ AUTH ERROR:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};
