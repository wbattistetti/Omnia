/**
 * Designer tooling for assistant message templates: wrap selection as `[token]` or strip bracket markup.
 */

/** True if text contains at least one `[...]` span. */
export function messageHasSlotBrackets(text: string): boolean {
  return /\[[^\]]+\]/.test(String(text ?? ''));
}

/**
 * Removes `[slot]` wrappers while keeping inner text (undo token markup).
 */
export function stripAgentMessageSlotBrackets(text: string): string {
  return String(text ?? '').replace(/\[([^\]]+)\]/g, '$1');
}
