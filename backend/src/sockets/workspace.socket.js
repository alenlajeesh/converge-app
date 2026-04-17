const Message = require("../models/Message");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

const workspaceSocket = (io) => {

  // 🔐 SOCKET AUTH MIDDLEWARE
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        console.log("❌ No token provided");
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, JWT_SECRET);

      console.log("🔍 DECODED TOKEN:", decoded);

      socket.user = decoded;

      next();
    } catch (err) {
      console.log("❌ Socket auth failed:", err.message);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("🔌 Incoming socket:", socket.id);
    console.log("✅ Authenticated:", socket.user.username);

    // 📡 JOIN WORKSPACE ROOM
    socket.on("join-workspace", ({ workspaceId }) => {
      if (!workspaceId) {
        console.log("❌ join-workspace: missing workspaceId");
        return;
      }

      console.log("📡 Joining room:", workspaceId);
      socket.join(workspaceId);
    });

    // 📨 SEND MESSAGE
    socket.on("send-message", async ({ workspaceId, message }) => {
      try {
        if (!workspaceId || !message) {
          console.log("❌ Invalid message payload");
          return;
        }

        const user = await User.findById(socket.user.id);

        if (!user) {
          console.log("❌ User not found in DB");
          return;
        }

        const msg = await Message.create({
          workspaceId,
          userId: user._id,
          username: user.username,
          message,
        });

        console.log("📨 Message saved:", message);

        // 🔥 BROADCAST TO ROOM
        io.to(workspaceId).emit("receive-message", msg);

      } catch (err) {
        console.error("❌ Message error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
    });
  });
};

module.exports = workspaceSocket;
