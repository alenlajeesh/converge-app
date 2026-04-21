const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth.middleware");
const { getMessages, deleteMessage } = require("../controllers/chat.controller");

router.get("/:workspaceId",       auth, getMessages);
router.delete("/:messageId",      auth, deleteMessage);

module.exports = router;
