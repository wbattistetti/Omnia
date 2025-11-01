// Puri selettori/mappers per DDT. Nessuna dipendenza da React.
// Le funzioni sono tolleranti a strutture diverse (steps come array o come oggetto, messages annidati, ecc.)

export function getMainDataList(ddt: any): any[] {
  if (!ddt) return [];

  // Caso 1: ddt.mainData è un array
  if (Array.isArray(ddt.mainData)) return ddt.mainData.filter(Boolean);

  // Caso 2: ddt.mainData è un singolo oggetto
  if (ddt.mainData && typeof ddt.mainData === 'object') return [ddt.mainData];

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
    console.log('[ddtSelectors][getNodeSteps] Node is null/undefined');
    return [];
  }

  // 🐛 DEBUG: Log completo del nodo DOPO build messaggi
  console.log('[ddtSelectors][getNodeSteps] FULL NODE', {
    label: node?.label,
    hasSteps: !!node.steps,
    steps: node.steps,
    stepsType: typeof node.steps,
    stepsIsArray: Array.isArray(node.steps),
    stepsKeys: node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps) ? Object.keys(node.steps) : [],
    stepsLength: Array.isArray(node.steps) ? node.steps.length : (node.steps && typeof node.steps === 'object' ? Object.keys(node.steps).length : 0),
    hasMessages: !!node.messages,
    messages: node.messages,
    messagesKeys: node.messages && typeof node.messages === 'object' ? Object.keys(node.messages) : [],
    allKeys: Object.keys(node || {})
  });

  const present = new Set<string>();

  // Variante A: steps come array: [{ type: 'start', ... }, ...]
  if (Array.isArray(node.steps)) {
    console.log('[ddtSelectors][getNodeSteps] Found steps as array', {
      nodeLabel: node?.label,
      stepsLength: node.steps.length,
      stepsTypes: node.steps.map((s: any) => s?.type)
    });
    for (const s of node.steps) {
      const t = s?.type;
      if (typeof t === 'string' && t.trim()) present.add(t);
    }
  }

  // Variante B: steps come oggetto: { start: {...}, success: {...} }
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    console.log('[ddtSelectors][getNodeSteps] Found steps as object', {
      nodeLabel: node?.label,
      stepsKeys: Object.keys(node.steps)
    });
    for (const key of Object.keys(node.steps)) {
      const val = node.steps[key];
      if (val != null) present.add(key);
    }
  }

  // Variante C: messages annidati in node.messages
  if (node.messages && typeof node.messages === 'object') {
    console.log('[ddtSelectors][getNodeSteps] Found messages object', {
      nodeLabel: node?.label,
      messagesKeys: Object.keys(node.messages)
    });
    for (const key of Object.keys(node.messages)) {
      const val = node.messages[key];
      if (val != null) present.add(key);
    }
  }

  if (present.size === 0) {
    console.log('[ddtSelectors][getNodeSteps] No steps found', {
      nodeLabel: node?.label,
      hasSteps: !!node.steps,
      stepsType: typeof node.steps,
      hasMessages: !!node.messages,
      nodeKeys: Object.keys(node || {})
    });
    return [];
  }

  // Ritorna nell'ordine noto, con append di eventuali step custom
  const orderedKnown = DEFAULT_STEP_ORDER.filter((k) => present.has(k));
  const custom = Array.from(present).filter((k) => !DEFAULT_STEP_ORDER.includes(k)).sort();
  const result = [...orderedKnown, ...custom];
  console.log('[ddtSelectors][getNodeSteps] Returning steps', {
    nodeLabel: node?.label,
    result: JSON.stringify(result),
    resultLength: result.length,
    present: JSON.stringify(Array.from(present)),
    presentSize: present.size,
    orderedKnown: JSON.stringify(orderedKnown),
    custom: JSON.stringify(custom)
  });
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
  const mains = getMainDataList(ddt);
  if (mains.length === 0) return null;

  const safeMainIdx = Number.isFinite(mainIndex) && mainIndex >= 0 && mainIndex < mains.length ? mainIndex : 0;
  const main = mains[safeMainIdx];
  if (subIndex == null) return main;

  const subs = getSubDataList(main);
  const safeSubIdx = Number.isFinite(subIndex) && subIndex >= 0 && subIndex < subs.length ? subIndex : 0;
  return subs.length > 0 ? (subs[safeSubIdx] || main) : main;
}

export function getLabel(node: any): string {
  if (!node) return '';
  return (node.label || node.name || '').toString();
}

export function hasMultipleMains(ddt: any): boolean {
  return getMainDataList(ddt).length >= 2;
}



