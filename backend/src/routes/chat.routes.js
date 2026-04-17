const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { getMessages } = require("../controllers/chat.controller");

// ✅ auth added
router.get("/:workspaceId", auth, getMessages);

module.exports = router;
