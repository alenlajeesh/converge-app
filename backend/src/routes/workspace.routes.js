// src/routes/workspace.routes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");


const {
  createWorkspace,
  joinWorkspace,
  getWorkspace,
	linkWorkspace
} = require("../controllers/workspace.controller");

router.post("/create",createWorkspace);
router.post("/join", auth,joinWorkspace);
router.get("/:id", auth,getWorkspace);
router.post("/link", auth, linkWorkspace);
module.exports = router;
