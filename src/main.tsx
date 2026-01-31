import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.tsx';
import './index.css';
// Import status checker for TaskTemplatesV2
import './utils/showTaskTemplatesV2Status';
// ✅ Import fetch interceptor to suppress 404 errors for expected endpoints
import './utils/fetchInterceptor';

// ✅ Silence Monaco Editor "Canceled" errors during cleanup (harmless in dev mode)
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Filter out Monaco "Canceled" errors - they're harmless cleanup warnings
  const message = args[0]?.toString() || '';
  if (message.includes('Canceled: Canceled') || message.includes('Delayer.cancel')) {
    return; // Silently ignore
  }
  originalConsoleError.apply(console, args);
};

// 🚀 ENTERPRISE LOGGING SYSTEM
import { logger } from './utils/logger';

// 🚫 DISABILITA TUTTI I console.log NATIVI PER EVITARE LOOP INFINITI
// Usa invece il Logger centralizzato che può essere controllato
const DISABLE_NATIVE_LOGS = false; // Abilita console.log per debug
if (DISABLE_NATIVE_LOGS) {
  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalInfo = console.info;

  console.log = () => { };
  console.debug = () => { };
  console.info = () => { };

  // Mantieni solo console.error e console.warn per errori critici
  // Il Logger centralizzato userà questi metodi quando abilitato
}

// Initialize logging system
// Logger è DISABILITATO di default per evitare loop infiniti
// Per abilitarlo durante lo sviluppo: window.Logger.enable()
// Per abilitare componenti specifici: window.Logger.enableComponent('DDT_WIZARD')
// Per abilitare temporaneamente: window.Logger.enableFor(5000) // 5 secondi

if (typeof window !== 'undefined') {
  // ❌ RIMOSSO: log informativi su come usare il logger (non necessari all'avvio)
  // console.log('🔧 Logger available globally as window.Logger');
  // console.log('💡 Use window.Logger.enable() to enable logging');
  // console.log('💡 Use window.Logger.enableComponent("DDT_WIZARD") to enable specific component');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
