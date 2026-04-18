/**
 * Human-readable backend reference embedded in IR / description text (deterministic compile).
 */

/** Unicode filing cabinet — visible in plain-text editors. */
export const BACKEND_TOKEN_ICON = '🗄️';

/** Inserted fragment: icon, space, backend path (e.g. agenda.getDisponibilita). */
export function formatBackendDisplayToken(backendPath: string): string {
  const p = String(backendPath ?? '').trim();
  if (!p) {
    throw new Error('formatBackendDisplayToken: backend path is required');
  }
  return `${BACKEND_TOKEN_ICON} ${p}`;
}

/** Matches `🗄️ agenda.getDisponibilita` style tokens in section markdown. */
export const BACKEND_DISPLAY_TOKEN_REGEX = /🗄️\s+([A-Za-z0-9_.]+)/gu;
