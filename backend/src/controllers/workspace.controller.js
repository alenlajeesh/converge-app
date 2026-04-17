const Workspace = require("../models/Workspace");
const { nanoid } = require("nanoid");

// ✅ CREATE WORKSPACE
exports.createWorkspace = async (req, res) => {
  try {
    const { name, repoUrl, localPath } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: "Name required" });
    }

    const joinCode = nanoid(6);

    const workspace = await Workspace.create({
      name,
      repoUrl,
      localPath,
      joinCode,
      createdBy: userId,
      members: [userId],
    });

    res.json(workspace);

  } catch (err) {
    console.error("CREATE WORKSPACE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ JOIN WORKSPACE (🔥 FULLY FIXED)
exports.joinWorkspace = async (req, res) => {
  try {
    const { joinCode } = req.body;
    const userId = req.user?.id;

    console.log("🔍 JOIN CODE:", joinCode);
    console.log("👤 USER ID:", userId);

    // 🔴 Validate input
    if (!joinCode) {
      return res.status(400).json({ message: "Join code required" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 🔍 Find workspace
    const workspace = await Workspace.findOne({ joinCode });

    if (!workspace) {
      return res.status(404).json({ message: "Invalid code" });
    }

    // ✅ FIXED: ObjectId comparison
    const isMember = workspace.members.some(
      (id) => id.toString() === userId
    );

    if (!isMember) {
      workspace.members.push(userId);
      await workspace.save();
    }

    res.json(workspace);

  } catch (err) {
    console.error("❌ JOIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ GET WORKSPACE
exports.getWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    res.json(workspace);

  } catch (err) {
    console.error("GET WORKSPACE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// 🔥 LINK LOCAL WORKSPACE
exports.linkWorkspace = async (req, res) => {
  try {
    const { localPath, name } = req.body;
    const userId = req.user.id;

    if (!localPath) {
      return res.status(400).json({ message: "localPath required" });
    }

    let workspace = await Workspace.findOne({ localPath });

    // 🔁 EXISTING
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

    // 🆕 CREATE NEW
    const joinCode = nanoid(6);

    workspace = await Workspace.create({
      name: name || "Local Workspace",
      localPath,
      joinCode,
      createdBy: userId,
      members: [userId],
    });

    res.json(workspace);

  } catch (err) {
    console.error("LINK WORKSPACE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
