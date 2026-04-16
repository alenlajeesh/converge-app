const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  repoUrl: {
    type: String,
  },

  // 🔥 CRITICAL (used for linking local folders)
  localPath: {
    type: String,
  },

  // 🔑 Invite code
  joinCode: {
    type: String,
    unique: true,
  },

  // 👤 Owner
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // 👥 Members (REAL SYSTEM)
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Workspace", workspaceSchema);
