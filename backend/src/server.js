const express = require("express");
const cors    = require("cors");
const http    = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB        = require("./config/db");
const authRoutes       = require("./routes/auth.routes");
const workspaceRoutes  = require("./routes/workspace.routes");
const chatRoutes       = require("./routes/chat.routes");
const taskRoutes       = require("./routes/task.routes");
const workspaceSocket  = require("./sockets/workspace.socket");

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth",      authRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/chat",      chatRoutes);
app.use("/api/tasks",     taskRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

workspaceSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
