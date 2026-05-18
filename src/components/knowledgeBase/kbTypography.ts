/**
 * Unified typography for the KB workspace (12px monospace = reader / Monaco baseline).
 */

/** Base text — use on workspace root so children inherit size and family. */
export const KB_WORKSPACE_ROOT = 'font-mono text-xs leading-normal';

export const kbType = {
  body: 'text-slate-300',
  muted: 'text-slate-500',
  label: 'font-medium uppercase tracking-wide text-slate-500',
  title: 'font-semibold text-slate-100',
  accent: 'text-violet-100',
  error: 'text-rose-300',
  warn: 'text-amber-300/90',
} as const;
