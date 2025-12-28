
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/polyfills';
// Include FontAwesome CSS so legacy <i class="fas ..."> icons render correctly
import '@fortawesome/fontawesome-free/css/all.min.css';

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
