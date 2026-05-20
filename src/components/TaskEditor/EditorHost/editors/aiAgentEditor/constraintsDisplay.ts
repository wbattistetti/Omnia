/**
 * Guardrails (constraints) section: normalizes Must / Must not blocks into one rule per bullet line.
 */

const MUST_LABEL = 'Must:';
const MUST_NOT_LABEL = 'Must not:';

function normalizeBulletLine(line: string): string {
  const t = line.trim();
  if (!t) return '';
  if (/^[-*•]\s+/.test(t)) return t.replace(/^[*•]\s+/, '- ');
  if (/^\d+\.\s+/.test(t)) return t;
  return `- ${t}`;
}

function bodyToBulletLines(body: string): string[] {
  const raw = body.trim();
  if (!raw) return [];
  const byNl = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (byNl.length > 1) {
    return byNl.map(normalizeBulletLine).filter(Boolean);
  }
  const single = byNl[0] ?? raw;
  const bySemi = single.split(/\s*;\s+/).map((s) => s.trim()).filter((s) => s.length > 8);
  if (bySemi.length > 1) {
    return bySemi.map(normalizeBulletLine).filter(Boolean);
  }
  const sentences = single
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (sentences.length > 1) {
    return sentences.map(normalizeBulletLine).filter(Boolean);
  }
  return [normalizeBulletLine(single)].filter(Boolean);
}

function extractBlock(text: string, label: string, nextLabel: string | null): string {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startRe = new RegExp(`^${esc}\\s*`, 'im');
  const start = text.search(startRe);
  if (start < 0) return '';
  let bodyStart = start + label.length;
  while (bodyStart < text.length && /\s/.test(text[bodyStart])) bodyStart += 1;
  let bodyEnd = text.length;
  if (nextLabel) {
    const nextEsc = nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nextRe = new RegExp(`\\n\\s*${nextEsc}\\s*`, 'i');
    const nextAt = text.slice(bodyStart).search(nextRe);
    if (nextAt >= 0) bodyEnd = bodyStart + nextAt;
  }
  return text.slice(bodyStart, bodyEnd).trim();
}

/**
 * Formats constraints for the revision editor: Must / Must not headers with `-` bullets per rule.
 */
export function formatConstraintsBullets(text: string): string {
  const t = text.trim();
  if (!t) return '';

  const mustBody = extractBlock(t, MUST_LABEL, MUST_NOT_LABEL);
  const mustNotBody = extractBlock(t, MUST_NOT_LABEL, null);

  if (!mustBody && !mustNotBody) {
    return bodyToBulletLines(t).join('\n');
  }

  const parts: string[] = [];
  if (mustBody) {
    parts.push(MUST_LABEL, ...bodyToBulletLines(mustBody));
  }
  if (mustNotBody) {
    if (parts.length > 0) parts.push('');
    parts.push(MUST_NOT_LABEL, ...bodyToBulletLines(mustNotBody));
  }
  return parts.join('\n');
}
