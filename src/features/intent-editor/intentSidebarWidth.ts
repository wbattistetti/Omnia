/**
 * Default width for the embeddings editor intents column so labels fit without ellipsis.
 * Uses approximate character width for text-sm plus space for checkbox, icons, and badges.
 */

const MIN_PX = 220;
const MAX_DEFAULT_FIT_PX = 640;

/** ~px per character at typical UI font sizes (text-sm). */
const APPROX_CHAR_PX = 7.5;
/** Checkbox, branch icon, count badge, padding, edit/delete hover targets. */
const CHROME_EXTRA_PX = 132;

export function clampIntentSidebarWidth(px: number, min = MIN_PX, max = MAX_DEFAULT_FIT_PX): number {
  return Math.min(max, Math.max(min, Math.round(px)));
}

/**
 * Returns a width in px that should fit the longest intent name on one line (for typical labels).
 */
export function computeIntentSidebarWidth(intents: { name?: string }[]): number {
  const maxChars = intents.reduce((m, i) => Math.max(m, (i.name ?? '').length), 0);
  const estimated = maxChars * APPROX_CHAR_PX + CHROME_EXTRA_PX;
  return clampIntentSidebarWidth(estimated);
}

export const INTENT_SIDEBAR_STORAGE_KEY = 'omnia.embeddingEditor.intentsPaneWidth';

export function readStoredIntentSidebarWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INTENT_SIDEBAR_STORAGE_KEY);
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    return clampIntentSidebarWidth(n);
  } catch {
    return null;
  }
}

export function persistIntentSidebarWidth(px: number): void {
  try {
    localStorage.setItem(INTENT_SIDEBAR_STORAGE_KEY, String(Math.round(px)));
  } catch {
    /* ignore quota / private mode */
  }
}
