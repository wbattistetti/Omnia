/**
 * Normalizes rich structured sections for the revision editor (readable lists, one step per line).
 */

export { formatConstraintsBullets } from './constraintsDisplay';

function normalizeStepLine(line: string): string {
  const t = line.trim();
  if (!t) return '';
  if (/^[-*•]\s+/.test(t)) return t.replace(/^[*•]\s+/, '- ');
  if (/^\d+\.\s+/.test(t)) return t;
  return `- ${t}`;
}

function splitProseIntoStepCandidates(single: string): string[] {
  const byNum = single.split(/(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
  if (byNum.length > 1) return byNum;
  const sentences = single
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (sentences.length >= 2) return sentences;
  return [single];
}

/**
 * Operational sequence: one step per line with `- ` or `N. ` prefix (idempotent).
 */
export function formatOperationalSequenceNewlines(text: string): string {
  const t = text.trim();
  if (!t) return '';

  const byNl = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  let candidates: string[];
  if (byNl.length > 1) {
    candidates = byNl;
  } else {
    const single = byNl[0] ?? t;
    const byNum = single.split(/(?=\s*\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
    candidates = byNum.length > 1 ? byNum : splitProseIntoStepCandidates(single);
  }

  const lines = candidates.map(normalizeStepLine).filter(Boolean);
  if (lines.length === 0) return t;
  if (lines.length === 1 && lines[0] === normalizeStepLine(t)) return lines[0];
  return lines.join('\n');
}

export function splitOperationalSequenceLines(text: string): string[] {
  const formatted = formatOperationalSequenceNewlines(text);
  if (!formatted) return [];
  return formatted.split('\n');
}
