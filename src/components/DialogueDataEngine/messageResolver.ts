// Message resolver with precedence and simple placeholder interpolation
// Order: textKey -> translations -> actionText -> fallback

type Vars = Record<string, string | number | boolean | null | undefined>;

export interface ResolveOptions {
  textKey?: string | null;
  translations?: Record<string, string>;
  actionText?: string | null; // optional legacy/action source
  fallback?: string | null; // final fallback if nothing else resolves
  vars?: Vars; // {{var}} interpolation values
}

function interpolate(text: string, vars?: Vars): string {
  if (!text || !vars) return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function resolveMessage(opts: ResolveOptions): string {
  const key = opts.textKey || '';
  const t = opts.translations || {};
  const byKey = key && t[key];
  const chosen = byKey || opts.actionText || opts.fallback || '';
  return interpolate(chosen, opts.vars);
}

export interface FallbackTemplates {
  ask: (label: string) => string;
  confirm: (label: string, value?: unknown) => string;
  success: (label: string) => string;
}

export const DEFAULT_FALLBACKS: FallbackTemplates = {
  ask: (label) => `Provide ${label}.`,
  confirm: (label, value) => `Confirm ${label}${value !== undefined ? `: ${value}` : ''}?`,
  success: (label) => `Recorded ${label}.`,
};


