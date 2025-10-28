import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.tsx';
import './index.css';

// 🚫 DISATTIVA TUTTI I console.log PER EVITARE LOOP INFINITI
const DISABLE_ALL_LOGS = false; // 🚀 TEMPORARY: Enable logs to debug TaskCounter
if (DISABLE_ALL_LOGS) {
  console.log = () => { };
  console.debug = () => { };
  console.info = () => { };
  // Mantieni solo console.error e console.warn per errori critici
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
