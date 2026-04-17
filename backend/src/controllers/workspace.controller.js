const Workspace = require("../models/Workspace");
const { nanoid } = require("nanoid");

// CREATE
exports.createWorkspace = async (req, res) => {
  try {
    const { name, repoUrl, localPath } = req.body;
    const userId = req.user.id;

    if (!name)
      return res.status(400).json({ message: "Name required" });

    const joinCode = nanoid(6);

    const workspace = await Workspace.create({
      name,
      repoUrl:   repoUrl   || null,
      localPath: localPath || null,
      joinCode,
      createdBy: userId,
      members:   [userId]
    });

    res.json(workspace);
  } catch (err) {
    console.error("CREATE WORKSPACE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// JOIN
exports.joinWorkspace = async (req, res) => {
  try {
    const { joinCode } = req.body;
    const userId = req.user.id;

    if (!joinCode)
      return res.status(400).json({ message: "Join code required" });

    const workspace = await Workspace.findOne({ joinCode });
    if (!workspace)
      return res.status(404).json({ message: "Invalid join code" });

    const isMember = workspace.members.some(
      (id) => id.toString() === userId
    );

    if (!isMember) {
      workspace.members.push(userId);
      await workspace.save();
    }

    res.json(workspace);
  } catch (err) {
    console.error("JOIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// GET — only members can fetch
exports.getWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace)
      return res.status(404).json({ message: "Workspace not found" });

    const isMember = workspace.members.some(
      (id) => id.toString() === req.user.id
    );

    if (!isMember)
      return res.status(403).json({ message: "Access denied" });

    res.json(workspace);
  } catch (err) {
    console.error("GET WORKSPACE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// LINK LOCAL
exports.linkWorkspace = async (req, res) => {
  try {
    const { localPath, name } = req.body;
    const userId = req.user.id;

    if (!localPath)
      return res.status(400).json({ message: "localPath required" });

    let workspace = await Workspace.findOne({ localPath });

    if (workspace) {
      const isMember = workspace.members.some(
        (id) => id.toString() === userId
      );
      if (!isMember) {
        workspace.members.push(userId);
        await workspace.save();
      }
      return res.json(workspace);
    }

    const joinCode = nanoid(6);
    workspace = await Workspace.create({
      name:      name || "Local Workspace",
      localPath,
      joinCode,
      createdBy: userId,
      members:   [userId]
    });

    res.json(workspace);
  } catch (err) {
    console.error("LINK WORKSPACE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
