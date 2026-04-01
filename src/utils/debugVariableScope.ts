/**
 * Opt-in debug logging for variable store ↔ flow snapshot ↔ condition editor.
 * Enable in DevTools: localStorage.setItem('omnia:debugVariables', '1') then reload.
 * Disable: localStorage.removeItem('omnia:debugVariables')
 */

export function isVariableScopeDebugEnabled(): boolean {
  if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env?.PROD) {
    return false;
  }
  try {
    return localStorage.getItem('omnia:debugVariables') === '1';
  } catch {
    return false;
  }
}

export function logVariableScope(tag: string, payload: Record<string, unknown>): void {
  if (!isVariableScopeDebugEnabled()) {
    return;
  }
  console.log(`[VarScope:${tag}]`, payload);
}
