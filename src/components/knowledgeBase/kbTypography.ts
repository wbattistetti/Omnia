/**
 * Unified typography for the KB workspace (12px monospace = use case panel baseline).
 */

/** Tailwind stack — matches Monaco `fontFamily` in the reader. */
export const KB_MONACO_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Base text — use on workspace root so children inherit size and family. */
export const KB_WORKSPACE_ROOT = 'font-mono text-xs leading-normal';

export const kbType = {
  body: 'text-inherit text-slate-300',
  muted: 'text-inherit text-slate-500',
  label: 'text-inherit font-medium uppercase tracking-wide text-slate-500',
  title: 'text-inherit font-semibold text-slate-100',
  accent: 'text-inherit text-violet-100',
  error: 'text-inherit text-rose-300',
  warn: 'text-inherit text-amber-300/90',
  status: 'text-inherit text-slate-400',
} as const;
