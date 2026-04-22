const Message   = require("../models/Message");
const Workspace = require("../models/Workspace");

// ─── GET MESSAGES ─────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const { workspaceId } = req.params;

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

// ─── DELETE MESSAGE ───────────────────────
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId        = req.user.id;

    const message = await Message.findById(messageId);
    if (!message)
      return res.status(404).json({ message: "Message not found" });

    // ✅ Only the message owner can delete
    if (message.userId.toString() !== userId)
      return res.status(403).json({ message: "You can only delete your own messages" });

    await Message.findByIdAndDelete(messageId);

    res.json({ success: true, messageId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
