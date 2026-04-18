/**
 * Backend placeholder definitions for deterministic compile (dynamic paths from drag-drop).
 */

import type { BackendPlaceholderDefinition } from './types';

/** Built-in catalog entries removed — paths come from flow BackendCall rows (`definitionId` = method path). */
export const BACKEND_PLACEHOLDER_DEFINITIONS: readonly BackendPlaceholderDefinition[] = [];

const byId = new Map(BACKEND_PLACEHOLDER_DEFINITIONS.map((d) => [d.id, d]));

function isBackendPathShape(id: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.]*$/.test(id);
}

/** Resolves registry entry or synthesizes one for drag-dropped backend paths (e.g. `agenda.getDisponibilita`). */
export function getBackendPlaceholderDefinition(
  id: string
): BackendPlaceholderDefinition | undefined {
  const trimmed = String(id ?? '').trim();
  const fixed = byId.get(trimmed);
  if (fixed) {
    return fixed;
  }
  if (!isBackendPathShape(trimmed)) {
    return undefined;
  }
  /** Plain path — avoid `🗄️` here so post-compose expansion cannot match inside generated XML attributes. */
  const label = trimmed;
  return {
    id: trimmed,
    label,
    description: 'Backend integration reference (design-time token).',
    ioSignature: `backend:${trimmed}`,
  };
}
