// src/routes/workspace.routes.js
const express = require("express");
const router = express.Router();

const {
  createWorkspace,
  joinWorkspace,
  getWorkspace
} = require("../controllers/workspace.controller");

router.post("/create", createWorkspace);
router.post("/join", joinWorkspace);
router.get("/:id", getWorkspace);

module.exports = router;
