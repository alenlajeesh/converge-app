const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const {
  createWorkspace,
  joinWorkspace,
  getWorkspace,
  linkWorkspace
} = require("../controllers/workspace.controller");

// ✅ auth on ALL routes
router.post("/create", auth, createWorkspace);
router.post("/join",   auth, joinWorkspace);
router.post("/link",   auth, linkWorkspace);
router.get("/:id",     auth, getWorkspace);

module.exports = router;
