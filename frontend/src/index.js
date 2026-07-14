import process from "process";
import { Buffer } from "buffer";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
window.process = process;
window.Buffer = Buffer;
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

