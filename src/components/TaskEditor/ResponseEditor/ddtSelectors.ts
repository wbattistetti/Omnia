// Puri selettori/mappers per DDT. Nessuna dipendenza da React.
// Le funzioni sono tolleranti a strutture diverse (steps come array o come oggetto, messages annidati, ecc.)

export function getdataList(ddt: any): any[] {
  if (!ddt) return [];

  // Caso 1: ddt.data è un array
  if (Array.isArray(ddt.data)) return ddt.data.filter(Boolean);

  // Caso 2: ddt.data è un singolo oggetto
  if (ddt.data && typeof ddt.data === 'object') return [ddt.data];

  // Caso 3: il root DDT stesso è un "main" (ha label/steps/subData)
  const looksLikeNode = !!(ddt && (ddt.label || ddt.name || ddt.steps || ddt.subData));
  if (looksLikeNode) return [ddt];

  // Fallback
  return [];
}

export function getSubDataList(main: any): any[] {
  if (!main) return [];
  const sub = main.subData;
  return Array.isArray(sub) ? sub.filter(Boolean) : [];
}

// Ordine consigliato per la visualizzazione degli step
const DEFAULT_STEP_ORDER = [
  'start',
  'noInput',
  'noMatch',
  'explicitConfirmation',
  'confirmation',
  'notConfirmed',
  'success',
  'error',
];

export function getNodeSteps(node: any): string[] {
  if (!node) {
    // Removed verbose log
    return [];
  }

  // Removed verbose log

  const present = new Set<string>();

  // Variante A: steps come array: [{ type: 'start', ... }, ...]
  if (Array.isArray(node.steps)) {
    for (const s of node.steps) {
      const t = s?.type;
      if (typeof t === 'string' && t.trim()) present.add(t);
    }
  }

  // Variante B: steps come oggetto: { start: {...}, success: {...} }
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    for (const key of Object.keys(node.steps)) {
      const val = node.steps[key];
      if (val != null) present.add(key);
    }
  }

  // Variante C: messages annidati in node.messages
  if (node.messages && typeof node.messages === 'object') {
    for (const key of Object.keys(node.messages)) {
      const val = node.messages[key];
      if (val != null) present.add(key);
    }
  }

  if (present.size === 0) {
    return [];
  }

  // Ritorna nell'ordine noto, con append di eventuali step custom
  const orderedKnown = DEFAULT_STEP_ORDER.filter((k) => present.has(k));
  const custom = Array.from(present).filter((k) => !DEFAULT_STEP_ORDER.includes(k)).sort();
  const result = [...orderedKnown, ...custom];
  return result;
}

export function getMessagesFor(node: any, stepKey: string): any {
  if (!node || !stepKey) return {};

  // steps come array
  if (Array.isArray(node.steps)) {
    const found = node.steps.find((s: any) => s?.type === stepKey);
    if (found) return found;
  }

  // steps come oggetto
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    const val = node.steps[stepKey];
    if (val != null) return val;
  }

  // messages separati
  if (node.messages && typeof node.messages === 'object') {
    const val = node.messages[stepKey];
    if (val != null) return val;
  }

  return {};
}

export function findNode(ddt: any, mainIndex: number, subIndex: number | null): any {
  const mains = getdataList(ddt);
  if (mains.length === 0) return null;

  const safeMainIdx = Number.isFinite(mainIndex) && mainIndex >= 0 && mainIndex < mains.length ? mainIndex : 0;
  const main = mains[safeMainIdx];
  if (subIndex == null) return main;

  const subs = getSubDataList(main);
  const safeSubIdx = Number.isFinite(subIndex) && subIndex >= 0 && subIndex < subs.length ? subIndex : 0;
  return subs.length > 0 ? (subs[safeSubIdx] || main) : main;
}

/**
 * Get node label from Translations or fallback to node.label
 * @param node - The node object (must have id or _id)
 * @param translations - Optional translations dictionary { guid: text }
 * @returns The translated label or fallback to node.label
 */
export function getLabel(node: any, translations?: Record<string, string>): string {
  if (!node) return '';

  // ✅ Priority 1: Use Translations if available
  if (translations) {
    const guid = node.id || node._id;
    if (guid && translations[guid]) {
      return translations[guid];
    }
  }

  // ✅ Priority 2: Fallback to node.label (temporary, for backward compatibility)
  return (node.label || node.name || '').toString();
}

export function hasMultipleMains(ddt: any): boolean {
  return getdataList(ddt).length >= 2;
}

/**
 * React hook to get node label from Translations
 * Use this in React components that have access to ProjectTranslationsContext
 */
export function useNodeLabel(node: any): string {
  // Dynamic import to avoid breaking non-React contexts
  const React = require('react');
  const { useProjectTranslations } = require('../../../context/ProjectTranslationsContext');

  const { getTranslation } = useProjectTranslations();

  if (!node) return '';

  const guid = node.id || node._id;
  if (!guid) return '';

  // Use Translations if available, otherwise fallback to node.label
  return getTranslation(guid) || node.label || node.name || '';
}



