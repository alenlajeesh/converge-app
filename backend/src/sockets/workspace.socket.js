const Message   = require("../models/Message");
const User      = require("../models/User");
const Workspace = require("../models/Workspace");
const jwt       = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

const workspaceSocket = (io) => {

  // ── AUTH MIDDLEWARE ──────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user   = decoded; // { id, username }
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.user.username} (${socket.id})`);

    // ── JOIN ROOM ────────────────────────────
    socket.on("join-workspace", async ({ workspaceId }) => {
      if (!workspaceId) return;
      try {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return;

        const isMember = workspace.members.some(
          (id) => id.toString() === socket.user.id
        );
        if (!isMember) return;

        socket.join(workspaceId);
        console.log(`📡 ${socket.user.username} joined room: ${workspaceId}`);
      } catch (err) {
        console.error("join-workspace error:", err);
      }
    });

    // ── SEND MESSAGE ─────────────────────────
    socket.on("send-message", async ({ workspaceId, message }) => {
      try {
        if (!workspaceId || !message?.trim()) return;

        const user = await User.findById(socket.user.id);
        if (!user) return;

        const msg = await Message.create({
          workspaceId,
          userId:   user._id,
          username: user.username,
          message:  message.trim()
        });

        io.to(workspaceId).emit("receive-message", msg);
      } catch (err) {
        console.error("send-message error:", err);
      }
    });

    // ── DELETE MESSAGE ───────────────────────
    socket.on("delete-message", async ({ messageId, workspaceId }) => {
      try {
        if (!messageId || !workspaceId) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        // ✅ Only owner can delete
        if (message.userId.toString() !== socket.user.id) {
          console.log(`❌ ${socket.user.username} tried to delete someone else's message`);
          return;
        }

        await Message.findByIdAndDelete(messageId);

        // ✅ Broadcast deletion to everyone in the room
        // so all clients remove it from their UI instantly
        io.to(workspaceId).emit("message-deleted", { messageId });

        console.log(`🗑️ Message ${messageId} deleted by ${socket.user.username}`);
      } catch (err) {
        console.error("delete-message error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.user.username}`);
    });
  });
};

module.exports = workspaceSocket;
