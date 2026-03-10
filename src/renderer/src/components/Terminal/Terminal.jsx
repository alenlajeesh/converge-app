import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './Terminal.css';

const TerminalView = () => {
    const terminalRef = useRef(null);
    const xtermInstance = useRef(null);

    useEffect(() => {
        // Prevent multiple initializations
        if (xtermInstance.current) return;

        // Initialize xterm
        const term = new Terminal({
            theme: {
                background: '#1e1e1e',
                foreground: '#cccccc',
                cursor: '#aeafad'
            },
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'monospace'
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        term.open(terminalRef.current);
        
        // Timeout ensures the DOM has dimensions before we "fit"
        setTimeout(() => {
            fitAddon.fit();
        }, 100);

        // Listen for data from Main Process
        const removeListener = window.electronAPI.onTerminalData((data) => {
            term.write(data);
        });

        // Send keystrokes to Main Process
        term.onData(data => {
            window.electronAPI.sendTerminalInput(data);
        });

        xtermInstance.current = term;

        // Cleanup on unmount
        return () => {
            removeListener();
            term.dispose();
            xtermInstance.current = null;
        };
    }, []);

    return <div className="terminal-container" ref={terminalRef} />;
};

export default TerminalView;
