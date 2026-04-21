const Workspace = require("../models/Workspace");
const { nanoid } = require("nanoid");

// ─── CREATE ───────────────────────────────
exports.createWorkspace = async (req, res) => {
  try {
    const { name, repoUrl, localPath } = req.body;
    const userId = req.user.id;

    if (!name) return res.status(400).json({ message: "Name required" });

    const joinCode = nanoid(6);

    const workspace = await Workspace.create({
      name,
      repoUrl:   repoUrl?.trim()   || null,
      localPath: localPath?.trim() || null,
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

// ─── JOIN ─────────────────────────────────
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

// ─── GET ──────────────────────────────────
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

// ─── LINK LOCAL ───────────────────────────
exports.linkWorkspace = async (req, res) => {
  try {
    const { localPath, name, workspaceId } = req.body;
    const userId = req.user.id;

    if (!localPath)
      return res.status(400).json({ message: "localPath required" });

    // ✅ If frontend passes the known workspaceId, just fetch that directly
    // This avoids creating duplicates entirely
    if (workspaceId) {
      const workspace = await Workspace.findById(workspaceId);
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
    }

    // ✅ Try find by localPath
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

    // ✅ Only create new if truly doesn't exist anywhere
    // Read repoUrl from local workspace.json
    const fs   = require("fs");
    const path = require("path");
    let repoUrl = null;

    const configPath = path.join(localPath, "workspace.json");
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        repoUrl = config.github || null;
      } catch (_) {}
    }

    // ✅ Generate joinCode only once — never regenerate
    const joinCode = nanoid(6);
    workspace = await Workspace.create({
      name:      name || "Local Workspace",
      localPath,
      repoUrl,
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
