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

// Build catalog from global injected by App (fallback to empty)
// App sets window.__actionsCatalog after fetch('/data/actionsCatalog.json')
const RAW: any[] = (() => {
    try { return Array.isArray((window as any).__actionsCatalog) ? (window as any).__actionsCatalog : []; } catch { return []; }
})();

const baseById: Record<string, ActionMeta> = RAW.reduce((acc, a: any) => {
    const id = String(a?.id || '');
    if (!id) return acc;
    const label = a?.label?.it || a?.label?.en || id;
    const iconName = a?.icon || undefined;
    acc[id] = { id, label, iconName, color: a?.color };
    return acc;
}, {} as Record<string, ActionMeta>);

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

const CATALOG: Record<string, ActionMeta> = new Proxy(baseById, {
    get(target, p: string) {
        const key = String(p);
        const canonical = ALIASES[key] || key;
        return (target as any)[canonical] || { id: key, label: key, iconName: 'FileText' };
    }
}) as unknown as Record<string, ActionMeta>;

export function getActionMeta(actionId?: string): ActionMeta {
    if (!actionId) return { id: 'unknown', label: 'Azione', iconName: 'FileText' };
    return CATALOG[actionId] || { id: actionId, label: actionId, iconName: actionId };
}

export function getActionLabel(actionId?: string): string {
    return getActionMeta(actionId).label;
}

export function getActionIconNode(actionId?: string, color?: string): React.ReactNode {
    const meta = getActionMeta(actionId);
    const name = meta.iconName || actionId || 'FileText';
    return getIconComponent(name, color);
}


