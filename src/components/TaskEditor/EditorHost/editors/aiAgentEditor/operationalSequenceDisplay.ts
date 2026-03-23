/**
 * Operational sequence: helpers to format numbered steps (one line per step) for the revision editor.
 */

/**
 * Ensures each numbered step (`1. `, `2. `, …) is on its own line.
 * Idempotent on already-multiline content (trims each line, joins with `\n`).
 */
export function formatOperationalSequenceNewlines(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const byNl = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (byNl.length > 1) {
    return byNl.join('\n');
  }
  const single = byNl[0] ?? t;
  const byNum = single.split(/(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
  if (byNum.length <= 1) return single;
  return byNum.join('\n');
}

/**
 * Split operational-sequence text into lines (for tests / callers that need an array).
 */
export function splitOperationalSequenceLines(text: string): string[] {
  const formatted = formatOperationalSequenceNewlines(text);
  if (!formatted) return [];
  return formatted.split('\n');
}
