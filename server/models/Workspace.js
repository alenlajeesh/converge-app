const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  localPath: { type: String, required: true },
  githubRepoUrl: { type: String, default: '' },
  owner: { type: String, default: 'LocalUser' }, // We'll update this with real Auth later
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Workspace', WorkspaceSchema);
