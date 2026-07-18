const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth.middleware");
const {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getMembers,
  getComments,
  addComment,
  deleteComment
} = require("../controllers/task.controller");

router.get("/:workspaceId/members",     auth, getMembers);
router.get("/:workspaceId",             auth, getTasks);
router.post("/",                        auth, createTask);
router.patch("/:taskId",                auth, updateTask);
router.patch("/:taskId/status",         auth, updateTaskStatus);
router.delete("/:taskId",               auth, deleteTask);
router.get("/:taskId/comments",         auth, getComments);
router.post("/:taskId/comments",        auth, addComment);
router.delete("/:taskId/comments/:commentId", auth, deleteComment);

module.exports = router;