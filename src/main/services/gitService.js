const simpleGit = require('simple-git');

const getGitStatus = async (repoPath) => {
    try {
        const git = simpleGit(repoPath);
        const status = await git.status();
        const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
        return { branch, modified: status.modified.length, ahead: status.ahead };
    } catch (e) {
        return null; // Not a git repo
    }
};

const gitInit = async (repoPath) => {
    const git = simpleGit(repoPath);
    await git.init();
    return { success: true };
};

module.exports = { getGitStatus, gitInit };
