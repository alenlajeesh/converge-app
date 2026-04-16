const Message = require("../models/Message");

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      workspaceId: req.params.workspaceId
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
