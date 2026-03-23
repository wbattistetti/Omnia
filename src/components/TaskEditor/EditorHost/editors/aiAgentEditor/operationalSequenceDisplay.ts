/**
 * Split operational-sequence text into lines for bullet display (paragraph vs numbered list).
 */

export function splitOperationalSequenceLines(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const byNl = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (byNl.length > 1) return byNl;
  const single = byNl[0] ?? t;
  const byNum = single.split(/(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  return [single];
}
