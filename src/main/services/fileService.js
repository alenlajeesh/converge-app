const fs = require('fs').promises;
const path = require('path');

const getFiles = async (dirPath) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory()
    })).sort((a, b) => (b.isDirectory - a.isDirectory) || a.name.localeCompare(b.name));
};

const readFile = async (filePath) => {
    return await fs.readFile(filePath, 'utf-8');
};

const saveFile = async (filePath, content) => {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
};

module.exports = { getFiles, readFile, saveFile };
