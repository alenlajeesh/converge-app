const Task      = require("../models/Task");
const Workspace = require("../models/Workspace");
const User      = require("../models/User");

// ── helper: verify membership ──────────────
const verifyMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return null;
  const isMember = workspace.members.some(
    (id) => id.toString() === userId
  );
  return isMember ? workspace : null;
};

// ── GET TASKS ──────────────────────────────
exports.getTasks = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await verifyMember(workspaceId, req.user.id);
    if (!workspace)
      return res.status(403).json({ message: "Access denied" });

    const tasks = await Task.find({ workspaceId })
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CREATE TASK ────────────────────────────
exports.createTask = async (req, res) => {
  try {
    const { workspaceId, title, description, assignedToId, priority } = req.body;

    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });
    if (!title?.trim()) return res.status(400).json({ message: "Title required" });

    const workspace = await verifyMember(workspaceId, req.user.id);
    if (!workspace)
      return res.status(403).json({ message: "Access denied" });

    // Resolve assignee — default to self
    const targetId = assignedToId || req.user.id;
    const assignee = await User.findById(targetId).select("username");
    if (!assignee)
      return res.status(404).json({ message: "Assignee not found" });

    const creator = await User.findById(req.user.id).select("username");

    const task = await Task.create({
      workspaceId,
      title:              title.trim(),
      description:        description?.trim() || "",
      assignedTo:         assignee._id,
      assignedToUsername: assignee.username,
      assignedBy:         creator._id,
      assignedByUsername: creator.username,
      priority:           priority || "medium",
      status:             "pending"
    });

    res.json(task);
  } catch (err) {
    console.error("CREATE TASK ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE TASK STATUS ─────────────────────
exports.updateTaskStatus = async (req, res) => {
  try {
    const { taskId }  = req.params;
    const { status }  = req.body;
    const userId      = req.user.id;

    const validStatuses = ["pending", "inprogress", "done"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // ✅ Anyone in the workspace can update status
    const workspace = await verifyMember(task.workspaceId.toString(), userId);
    if (!workspace)
      return res.status(403).json({ message: "Access denied" });

    task.status = status;
    await task.save();

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE TASK ────────────────────────────
exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId     = req.user.id;

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // ✅ Only creator can delete
    if (task.assignedBy.toString() !== userId)
      return res.status(403).json({ message: "Only the task creator can delete it" });

    await Task.findByIdAndDelete(taskId);
    res.json({ success: true, taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET WORKSPACE MEMBERS ──────────────────
// Used to populate assignee dropdown
exports.getMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await verifyMember(workspaceId, req.user.id);
    if (!workspace)
      return res.status(403).json({ message: "Access denied" });

    const members = await User.find({
      _id: { $in: workspace.members }
    }).select("_id username");

    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
