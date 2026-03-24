/**
 * Stable opaque identities for AI Agent output slots (Omnia-side).
 * LLM must not emit these; the client assigns a new slotId per proposed field row.
 */

/**
 * Returns a new UUID v4 for an AI Agent output slot.
 */
export function createAgentOutputSlotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
