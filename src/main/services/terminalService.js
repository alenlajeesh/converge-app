const pty = require('node-pty');
const os = require('os');

const createTerminal = (mainWindow, shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash') => {
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env
    });

    ptyProcess.onData(data => {
        mainWindow.webContents.send('terminal:incomingData', data);
    });

    return ptyProcess;
};

module.exports = { createTerminal };
