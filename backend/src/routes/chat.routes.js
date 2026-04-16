// src/routes/chat.routes.js
const express = require("express");
const router = express.Router();

const { getMessages } = require("../controllers/chat.controller");

router.get("/:workspaceId", getMessages);

module.exports = router;
