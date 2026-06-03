/**
 * Match nomi documento KB Omnia ↔ ElevenLabs (troncamenti UI, prefissi search API).
 */

const MIN_SEARCH_PREFIX = 12;
const MAX_SEARCH_PREFIX = 48;

function normalizeKbDocName(name: string): string {
  return String(name ?? '').trim().toLowerCase();
}

function stripTruncationEllipsis(name: string): string {
  return normalizeKbDocName(name)
    .replace(/\.{2,}$/, '')
    .replace(/…$/, '')
    .trim();
}

/** True se il documento remoto corrisponde al file Omnia (match esatto o prefisso/troncamento). */
export function convaiKbDocNamesMatch(omniaName: string, remoteName: string): boolean {
  const a = stripTruncationEllipsis(omniaName);
  const b = stripTruncationEllipsis(remoteName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return false;
}

/** Prefissi per GET knowledge-base?search= (ElevenLabs: nomi che iniziano con la stringa). */
export function convaiKbSearchPrefixes(omniaName: string): string[] {
  const trimmed = String(omniaName ?? '').trim();
  if (!trimmed) return [];

  const out = new Set<string>();
  const len = trimmed.length;

  if (len >= MIN_SEARCH_PREFIX) {
    out.add(trimmed.slice(0, MIN_SEARCH_PREFIX));
  }
  if (len > MAX_SEARCH_PREFIX) {
    out.add(trimmed.slice(0, MAX_SEARCH_PREFIX));
  }
  out.add(trimmed.slice(0, Math.min(len, MAX_SEARCH_PREFIX)));

  const dashIdx = trimmed.indexOf(' - ');
  if (dashIdx >= MIN_SEARCH_PREFIX) {
    out.add(trimmed.slice(0, dashIdx));
  }

  return [...out].filter((p) => p.length >= MIN_SEARCH_PREFIX);
}
