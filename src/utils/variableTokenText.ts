/**
 * Utilities for bracket-variable tokens in free text editors.
 */
export type CaretRange = { start: number; end: number };

export function insertBracketTokenAtCaret(
  currentText: string,
  caret: CaretRange,
  variableLabel: string
): { text: string; caret: CaretRange } {
  const token = `[${variableLabel}]`;
  const start = Math.max(0, Math.min(caret.start ?? 0, currentText.length));
  const end = Math.max(start, Math.min(caret.end ?? start, currentText.length));
  const text = currentText.slice(0, start) + token + currentText.slice(end);
  const pos = start + token.length;
  return { text, caret: { start: pos, end: pos } };
}

export function extractBracketTokens(text: string): Array<{ value: string; start: number; end: number }> {
  const out: Array<{ value: string; start: number; end: number }> = [];
  if (!text) return out;
  const re = /\[\s*([^\[\]]+?)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ value: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}
