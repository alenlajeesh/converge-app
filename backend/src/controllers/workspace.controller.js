// src/controllers/workspace.controller.js
const Workspace = require("../models/Workspace");
const { nanoid } = require("nanoid");

exports.createWorkspace = async (req, res) => {
  try {
    const { name, repoUrl, username } = req.body;

    const joinCode = nanoid(6);

    const workspace = await Workspace.create({
      name,
      repoUrl,
      joinCode,
      members: [{ userId: "host", username }]
    });

    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.joinWorkspace = async (req, res) => {
  try {
    const { joinCode, username } = req.body;

    const workspace = await Workspace.findOne({ joinCode });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    workspace.members.push({
      userId: Date.now().toString(),
      username
    });

    await workspace.save();

    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
