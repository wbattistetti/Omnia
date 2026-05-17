/**
 * Extracts `{{variable}}` placeholders from ConvAI-style prompt text.
 */

const MUSTACHE_VAR_RE = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;

/** Unique variable names in first-seen order. */
export function extractTemplateVariableNames(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const src = String(text || '');
  let m: RegExpExecArray | null;
  MUSTACHE_VAR_RE.lastIndex = 0;
  while ((m = MUSTACHE_VAR_RE.exec(src)) !== null) {
    const name = m[1]?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
