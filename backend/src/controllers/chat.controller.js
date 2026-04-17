const Message = require("../models/Message");
const Workspace = require("../models/Workspace");

exports.getMessages = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // verify membership
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace)
      return res.status(404).json({ message: "Workspace not found" });

    const isMember = workspace.members.some(
      (id) => id.toString() === req.user.id
    );
    if (!isMember)
      return res.status(403).json({ message: "Access denied" });

    const messages = await Message.find({ workspaceId })
      .sort({ createdAt: 1 })
      .limit(200);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
