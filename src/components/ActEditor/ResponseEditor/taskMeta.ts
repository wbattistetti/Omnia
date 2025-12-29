// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import getIconComponent from './icons';

export type TaskMeta = {
    id: string;
    label: string;
    iconName?: string;
    color?: string;
};

// Aliases used in various parts of the UI → canonical IDs in tasksCatalog
const ALIASES: Record<string, string> = {
    // textual
    sayMessage: 'sayMessage',
    // ✅ Rimosso askQuestion: 'askQuestion', (ridondante, usare DataRequest)
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

// Build catalog dinamicamente ogni volta (come TaskList usa useActionsCatalog)
// Legge da window.__actionsCatalog quando chiamato, non all'inizializzazione
function getCatalog(): Record<string, TaskMeta> {
    try {
        const RAW: any[] = Array.isArray((window as any).__actionsCatalog)
            ? (window as any).__actionsCatalog
            : [];

        return RAW.reduce((acc, task: any) => {
            const id = String(task?.id || '');
            if (!id) return acc;
            // Stessa logica di TaskList: task.label[lang] || task.label.en || task.id
            const label = task?.label?.it || task?.label?.en || id;
            const iconName = task?.icon || undefined;
            acc[id] = { id, label, iconName, color: task?.color };
            return acc;
        }, {} as Record<string, TaskMeta>);
    } catch {
        return {};
    }
}

export function getTaskMeta(taskId?: string): TaskMeta {
    if (!taskId) return { id: 'unknown', label: 'Task', iconName: 'FileText' };

    const catalog = getCatalog(); // Legge dinamicamente da window.__actionsCatalog (come TaskList legge dal context)
    const canonical = ALIASES[taskId] || taskId;
    return catalog[canonical] || { id: taskId, label: taskId, iconName: 'FileText' };
}

export function getTaskLabel(taskId?: string): string {
    return getTaskMeta(taskId).label;
}

export function getTaskIconNode(taskId?: string, color?: string): React.ReactNode {
    const meta = getTaskMeta(taskId);
    const name = meta.iconName || taskId || 'FileText';
    return getIconComponent(name, color);
}

// Legacy aliases for backward compatibility (will be removed)
export const getActionMeta = getTaskMeta;
export const getActionLabel = getTaskLabel;
export const getActionIconNode = getTaskIconNode;
export type ActionMeta = TaskMeta;



