/**
 * Node Domain Operations
 *
 * Pure functions for node operations.
 * No side effects, no dependencies on React or state.
 */

/**
 * Get step keys from a node
 * Supports multiple formats: dictionary, array, legacy messages
 */
export function getNodeStepKeys(node: any): string[] {
  if (!node) {
    return [];
  }

  const present = new Set<string>();

  // Variant A: steps as dictionary: { "start": {...}, "noMatch": {...}, ... }
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    const stepKeys = Object.keys(node.steps);
    for (const stepKey of stepKeys) {
      const step = node.steps[stepKey];
      if (step && typeof step === 'object') {
        if (stepKey && stepKey.trim()) {
          present.add(stepKey);
        }
      }
    }
  }

  // Variant B: steps as array: [{ type: 'start', ... }, ...]
  if (Array.isArray(node.steps)) {
    for (const s of node.steps) {
      const t = s?.type;
      if (typeof t === 'string' && t.trim()) present.add(t);
    }
  }

  // Variant C: messages nested in node.messages (legacy)
  if (node.messages && typeof node.messages === 'object') {
    for (const key of Object.keys(node.messages)) {
      const val = node.messages[key];
      if (val != null) present.add(key);
    }
  }

  if (present.size === 0) {
    return [];
  }

  // Return in known order, with custom steps appended
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

  const orderedKnown = DEFAULT_STEP_ORDER.filter((k) => present.has(k));
  const custom = Array.from(present).filter((k) => !DEFAULT_STEP_ORDER.includes(k)).sort();
  return [...orderedKnown, ...custom];
}

/**
 * Get messages/step data for a specific step key
 * Supports multiple formats: array, dictionary, legacy messages
 */
export function getNodeStepData(node: any, stepKey: string): any {
  if (!node || !stepKey) return {};

  // steps as array
  if (Array.isArray(node.steps)) {
    const found = node.steps.find((s: any) => s?.type === stepKey);
    if (found) return found;
  }

  // steps as object
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    const val = node.steps[stepKey];
    if (val != null) return val;
  }

  // messages separated
  if (node.messages && typeof node.messages === 'object') {
    const val = node.messages[stepKey];
    if (val != null) return val;
  }

  return {};
}

/**
 * Get node label from translations or fallback to node.label
 */
export function getNodeLabel(node: any, translations?: Record<string, string>): string {
  if (!node) return '';

  // Priority 1: Use Translations if available
  if (translations) {
    const guid = node.id || node._id;
    if (guid && translations[guid]) {
      return translations[guid];
    }
  }

  // Priority 2: Fallback to node.label
  return (node.label || node.name || '').toString();
}

/**
 * Remove a node from nodes array (pure function)
 * Optionally removes children recursively
 */
export function removeNode(
  nodes: any[],
  id: string,
  removeChildren: boolean
): any[] {
  if (!removeChildren) {
    return nodes.filter(n => n.id !== id);
  }

  const toRemove = new Set([id]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
        toRemove.add(n.id);
        changed = true;
      }
    }
  }

  return nodes.filter(n => !toRemove.has(n.id));
}
