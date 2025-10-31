// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import getIconComponent from './icons';

export type ActionMeta = {
    id: string;
    label: string;
    iconName?: string;
    color?: string;
};

// Aliases used in various parts of the UI → canonical IDs in actionsCatalog
const ALIASES: Record<string, string> = {
    // textual
    sayMessage: 'sayMessage',
    askQuestion: 'askQuestion',
    // escalate
    toHuman: 'escalateToHuman',
    toGuardVR: 'escalateToGuardVR',
    // backend
    writeBackend: 'writeToBackend',
    readBackend: 'readFromBackend',
    // logging
    logData: 'logData',
    registerData: 'logData',
    logLabel: 'logLabel',
    // media
    jingle: 'playJingle',
    playJingle: 'playJingle',
    // flow
    jump: 'jump',
    skip: 'jump',
    hangUp: 'hangUp',
    close: 'hangUp',
    // comms
    sendEmail: 'sendEmail',
    sendSMS: 'sendSMS',
    // wait
    waitAgent: 'waitForAgent',
};

// Build catalog dinamicamente ogni volta (come ActionList usa useActionsCatalog)
// Legge da window.__actionsCatalog quando chiamato, non all'inizializzazione
function getCatalog(): Record<string, ActionMeta> {
    try {
        const RAW: any[] = Array.isArray((window as any).__actionsCatalog)
            ? (window as any).__actionsCatalog
            : [];

        return RAW.reduce((acc, a: any) => {
            const id = String(a?.id || '');
            if (!id) return acc;
            // Stessa logica di ActionList: action.label[lang] || action.label.en || action.id
            const label = a?.label?.it || a?.label?.en || id;
            const iconName = a?.icon || undefined;
            acc[id] = { id, label, iconName, color: a?.color };
            return acc;
        }, {} as Record<string, ActionMeta>);
    } catch {
        return {};
    }
}

export function getActionMeta(actionId?: string): ActionMeta {
    if (!actionId) return { id: 'unknown', label: 'Azione', iconName: 'FileText' };

    const catalog = getCatalog(); // Legge dinamicamente da window.__actionsCatalog (come ActionList legge dal context)
    const canonical = ALIASES[actionId] || actionId;
    return catalog[canonical] || { id: actionId, label: actionId, iconName: 'FileText' };
}

export function getActionLabel(actionId?: string): string {
    return getActionMeta(actionId).label;
}

export function getActionIconNode(actionId?: string, color?: string): React.ReactNode {
    const meta = getActionMeta(actionId);
    const name = meta.iconName || actionId || 'FileText';
    return getIconComponent(name, color);
}


