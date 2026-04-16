// src/sockets/workspace.socket.js
const Message = require("../models/Message");

const workspaceSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join workspace room
    socket.on("join-workspace", ({ workspaceId, username }) => {
      socket.join(workspaceId);

      socket.to(workspaceId).emit("user-joined", {
        username
      });
    });

    // Send message
    socket.on("send-message", async ({ workspaceId, message, username }) => {
      const msg = await Message.create({
        workspaceId,
        message,
        username
      });

      io.to(workspaceId).emit("receive-message", msg);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};

module.exports = workspaceSocket;
