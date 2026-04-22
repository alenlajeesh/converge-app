const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth.middleware");
const {
  getTasks,
  createTask,
  updateTaskStatus,
  deleteTask,
  getMembers
} = require("../controllers/task.controller");

router.get("/:workspaceId/members", auth, getMembers);
router.get("/:workspaceId",         auth, getTasks);
router.post("/",                    auth, createTask);
router.patch("/:taskId/status",     auth, updateTaskStatus);
router.delete("/:taskId",           auth, deleteTask);

module.exports = router;
