// src/server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");

const workspaceRoutes = require("./routes/workspace.routes");
const chatRoutes = require("./routes/chat.routes");
const workspaceSocket = require("./sockets/workspace.socket");

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/workspace", workspaceRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/auth", authRoutes);

// Create HTTP server
const server = http.createServer(app);

// Socket setup
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

workspaceSocket(io);

server.listen(process.env.PORT, () => {
  console.log("🚀 Server running on http://localhost:"+process.env.PORT);
});
