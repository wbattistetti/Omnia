/**
 * Validates document excerpt quotes against the loaded sample text.
 */

/** Collapses whitespace for fuzzy substring checks. */
export function normalizeExcerptForMatch(text: string): string {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when excerpt appears in the document sample (exact or prefix match). */
export function documentExcerptMatchesSample(excerpt: string, sample: string): boolean {
  const e = normalizeExcerptForMatch(excerpt);
  const s = normalizeExcerptForMatch(sample);
  if (!e || !s) return false;
  if (s.includes(e)) return true;
  if (e.length > 48) {
    const prefix = e.slice(0, Math.min(80, Math.floor(e.length * 0.6)));
    if (prefix.length >= 24 && s.includes(prefix)) return true;
  }
  return false;
}

/** Returns trimmed excerpt only if it matches the sample; otherwise undefined. */
export function sanitizeDocumentExcerpt(
  excerpt: unknown,
  sample: string
): string | undefined {
  const t = typeof excerpt === 'string' ? excerpt.trim() : '';
  if (!t || !documentExcerptMatchesSample(t, sample)) return undefined;
  return t.slice(0, 2_000);
}

/** True when excerpt is the designer note verbatim (not a distinct baseline quote). */
export function excerptDuplicatesDesignerNote(excerpt: string, designerNote: string): boolean {
  const e = normalizeExcerptForMatch(excerpt);
  const n = normalizeExcerptForMatch(designerNote);
  if (!e || !n) return false;
  return e === n;
}

/** One-line preview for accordion headers. */
export function observationHeaderPreview(text: string, maxLen = 120): string {
  const oneLine = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}
