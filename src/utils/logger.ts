/**
 * 🚀 SISTEMA DI LOGGING STRUTTURATO
 *
 * Sostituisce tutti i console.log sparsi con un sistema centralizzato e controllabile.
 * Risolve il problema dei log infiniti che causano loop di re-render.
 *
 * USAGE:
 * import { debug, error, enableDebug } from '../utils/Logger';
 *
 * debug('COMPONENT_NAME', 'Message', { data });
 * error('COMPONENT_NAME', 'Error occurred', error);
 * enableDebug(); // Solo quando serve per debug
 */

let isDebugEnabled = true; // ATTIVATO PER IDENTIFICARE TUTTI I LOOP

export const enableDebug = () => {
    isDebugEnabled = true;
    console.log("🚀 Debugging enabled.");
};

export const disableDebug = () => {
    isDebugEnabled = false;
    console.log("🚫 Debugging disabled.");
};

export const debug = (component: string, message: string, ...args: any[]) => {
    if (isDebugEnabled) {
        console.log(`[DEBUG][${component}] ${message}`, ...args);
    }
};

export const info = (component: string, message: string, ...args: any[]) => {
    if (isDebugEnabled) {
        console.info(`[INFO][${component}] ${message}`, ...args);
    }
};

export const warn = (component: string, message: string, ...args: any[]) => {
    if (isDebugEnabled) {
        console.warn(`[WARN][${component}] ${message}`, ...args);
    }
};

export const error = (component: string, message: string, ...args: any[]) => {
    console.error(`[ERROR][${component}] ${message}`, ...args);
};