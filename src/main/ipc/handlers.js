const { ipcMain, dialog } = require('electron');
const fileService = require('../services/fileService');
const gitService = require('../services/gitService');

const registerHandlers = (mainWindow) => {
    // Folder Picker
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        return canceled ? null : filePaths[0];
    });


    // Files
    ipcMain.handle('fs:getFiles', async (_, path) => await fileService.getFiles(path));
    ipcMain.handle('fs:readFile', async (_, path) => await fileService.readFile(path));
    ipcMain.handle('fs:saveFile', async (_, { path, content }) => await fileService.saveFile(path, content));

    // Git
    ipcMain.handle('git:getStatus', async (_, path) => await gitService.getGitStatus(path));
	// Add this inside your registerHandlers function
ipcMain.on('terminal:input', (event, data) => {
    if (global.terminalProcess) {
        global.terminalProcess.write(data);
    }
});
};

// IMPORTANT: This must match the destructuring in main.js
module.exports = { registerHandlers };
