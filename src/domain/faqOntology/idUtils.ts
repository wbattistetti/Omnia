/**
 * Stable IDs for ontology nodes (browser crypto).
 */

export function generateOntologyNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ont_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}
