
import './src/polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error("Root element not found. Ensure index.html has <div id='root'></div>");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
