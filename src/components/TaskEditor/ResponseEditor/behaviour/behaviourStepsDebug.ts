/**
 * Opt-in diagnostics for Behaviour step tabs / selectedNode.steps / taskTree.steps sync.
 * Enable: localStorage.setItem('debug.behaviourSteps', '1') then reload.
 */

const STORAGE_KEY = 'debug.behaviourSteps';

export function isBehaviourStepsDebug(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Short summary of node.steps shape for console (no deep clone). */
export function summarizeStepsShape(steps: unknown): {
  kind: 'missing' | 'array' | 'dict' | 'invalid';
  keysOrLength: string;
} {
  if (steps == null) {
    return { kind: 'missing', keysOrLength: '0' };
  }
  if (Array.isArray(steps)) {
    return { kind: 'array', keysOrLength: String(steps.length) };
  }
  if (typeof steps === 'object') {
    const keys = Object.keys(steps as Record<string, unknown>);
    return { kind: 'dict', keysOrLength: keys.length ? keys.join(',') : '(empty)' };
  }
  return { kind: 'invalid', keysOrLength: String(typeof steps) };
}

export function logBehaviourSteps(phase: string, payload: Record<string, unknown>): void {
  if (!isBehaviourStepsDebug()) return;
  console.log(`[behaviourSteps] ${phase}`, payload);
}
