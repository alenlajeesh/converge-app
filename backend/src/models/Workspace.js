// src/models/Workspace.js
const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema({
  name: String,
  repoUrl: String,
  joinCode: String,

  members: [
    {
      userId: String,
      username: String
    }
  ],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Workspace", workspaceSchema);
