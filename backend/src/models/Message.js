const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Workspace",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  username: { type: String, required: true },
  message:  { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
