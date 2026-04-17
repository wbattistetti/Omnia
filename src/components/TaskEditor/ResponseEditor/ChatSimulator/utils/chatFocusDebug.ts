/**
 * Diagnostica focus chat debugger / simulatore (opt-in).
 *
 * Attiva: `localStorage.setItem('omnia:debugChatFocus', '1');` poi ricarica.
 * Disattiva: `localStorage.removeItem('omnia:debugChatFocus');` poi ricarica.
 */

export function isChatFocusDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('omnia:debugChatFocus') === '1';
  } catch {
    return false;
  }
}

export function chatFocusDebug(event: string, detail?: Record<string, unknown>): void {
  if (!isChatFocusDebugEnabled()) return;
  if (detail !== undefined) {
    console.info(`[Omnia:chatFocus] ${event}`, detail);
  } else {
    console.info(`[Omnia:chatFocus] ${event}`);
  }
}

/** Compatto per capire chi ha il focus senza loggare testo utente. */
export function describeElement(el: Element | null): string {
  if (!el) return 'null';
  const tag = el.tagName?.toLowerCase() ?? '?';
  const id = el.id ? `#${el.id}` : '';
  let cls = '';
  if (el instanceof HTMLElement && typeof el.className === 'string' && el.className) {
    cls = '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.');
  }
  return `${tag}${id}${cls}`;
}
