const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerHandlers } = require('./ipc/handlers');
const { createTerminal } = require('./services/terminalService');

let mainWindow; // Define this globally in this file so handlers can access it

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        titleBarStyle: 'default',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadURL('http://localhost:5173');

    // Initialize Terminal and attach to global so handlers can use it
    global.terminalProcess = createTerminal(mainWindow);

    // Register all IPC tunnels
    registerHandlers(mainWindow);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
