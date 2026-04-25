const Message   = require("../models/Message");
const User      = require("../models/User");
const Workspace = require("../models/Workspace");
const jwt       = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

// Track active calls per workspace
// { workspaceId: { [socketId]: { userId, username, type: 'audio'|'video' } } }
const activeCalls = {};

const workspaceSocket = (io) => {

  // ── AUTH MIDDLEWARE ──────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.user.username} (${socket.id})`);

    // ── JOIN WORKSPACE ROOM ──────────────────
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
        socket.currentWorkspace = workspaceId;
        console.log(`📡 ${socket.user.username} joined room: ${workspaceId}`);

        // Send current call state to newly joined user
        if (activeCalls[workspaceId]) {
          const participants = Object.values(activeCalls[workspaceId]);
          if (participants.length > 0) {
            socket.emit("call-active", {
              participants,
              workspaceId
            });
          }
        }
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

        if (message.userId.toString() !== socket.user.id) return;

        await Message.findByIdAndDelete(messageId);
        io.to(workspaceId).emit("message-deleted", { messageId });
      } catch (err) {
        console.error("delete-message error:", err);
      }
    });

    // ════════════════════════════════════════
    // CALL SIGNALING
    // ════════════════════════════════════════

    // ── JOIN CALL ────────────────────────────
    socket.on("call-join", ({ workspaceId, callType }) => {
      if (!workspaceId) return;

      if (!activeCalls[workspaceId]) {
        activeCalls[workspaceId] = {};
      }

      const participant = {
        socketId: socket.id,
        userId:   socket.user.id,
        username: socket.user.username,
        callType
      };

      activeCalls[workspaceId][socket.id] = participant;

      console.log(`📞 ${socket.user.username} joined call in ${workspaceId}`);

      // Tell everyone else in workspace this person joined
      socket.to(workspaceId).emit("call-user-joined", participant);

      // Send existing participants to the new joiner
      const existing = Object.values(activeCalls[workspaceId])
        .filter((p) => p.socketId !== socket.id);

      socket.emit("call-existing-participants", { participants: existing });

      // Notify workspace about active call (for notification badge)
      io.to(workspaceId).emit("call-active", {
        participants: Object.values(activeCalls[workspaceId]),
        workspaceId
      });
    });

    // ── LEAVE CALL ───────────────────────────
    socket.on("call-leave", ({ workspaceId }) => {
      handleCallLeave(socket, workspaceId, io);
    });

    // ── WebRTC SIGNALING ─────────────────────

    // Offer from initiator to specific peer
    socket.on("call-offer", ({ targetSocketId, offer, callType }) => {
      io.to(targetSocketId).emit("call-offer", {
        fromSocketId: socket.id,
        fromUsername: socket.user.username,
        offer,
        callType
      });
    });

    // Answer from receiver back to initiator
    socket.on("call-answer", ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit("call-answer", {
        fromSocketId: socket.id,
        answer
      });
    });

    // ICE candidates
    socket.on("call-ice-candidate", ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit("call-ice-candidate", {
        fromSocketId: socket.id,
        candidate
      });
    });

    // ── DISCONNECT ───────────────────────────
    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.user.username}`);

      // Clean up call if in one
      if (socket.currentWorkspace) {
        handleCallLeave(socket, socket.currentWorkspace, io);
      }
    });
  });
};

// ── CALL LEAVE HELPER ────────────────────
function handleCallLeave(socket, workspaceId, io) {
  if (!activeCalls[workspaceId]) return;

  delete activeCalls[workspaceId][socket.id];

  const remaining = Object.values(activeCalls[workspaceId]);

  console.log(
    `📴 ${socket.user.username} left call. Remaining: ${remaining.length}`
  );

  // Tell everyone this person left
  io.to(workspaceId).emit("call-user-left", {
    socketId: socket.id,
    username: socket.user.username
  });

  if (remaining.length === 0) {
    // Last person left — call ended
    delete activeCalls[workspaceId];
    io.to(workspaceId).emit("call-ended", { workspaceId });
    console.log(`📴 Call ended in ${workspaceId}`);
  } else {
    // Update active call state for remaining users
    io.to(workspaceId).emit("call-active", {
      participants: remaining,
      workspaceId
    });
  }
}

module.exports = workspaceSocket;
