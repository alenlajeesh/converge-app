const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  authorId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "User",
    required: true
  },
  authorUsername: {
    type:     String,
    required: true
  },
  body: {
    type:     String,
    required: true,
    trim:     true
  },
  createdAt: {
    type:    Date,
    default: Date.now
  }
}, { _id: true });

const taskSchema = new mongoose.Schema({
  workspaceId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Workspace",
    required: true
  },
  title: {
    type:     String,
    required: true,
    trim:     true
  },
  description: {
    type:    String,
    default: "",
    trim:    true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User"
  },
  assignedToUsername: {
    type: String
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  "User"
  },
  assignedByUsername: {
    type: String
  },
  status: {
    type:    String,
    enum:    ["pending", "inprogress", "done"],
    default: "pending"
  },
  priority: {
    type:    String,
    enum:    ["low", "medium", "high"],
    default: "medium"
  },
  comments: {
    type:    [commentSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);