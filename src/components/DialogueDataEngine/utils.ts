export function normalize(text: string): string {
  return String(text || '').trim().toLowerCase();
}

export function isYes(text: string): boolean {
  const t = normalize(text);
  return t === 'yes' || t === 'y' || t === 'si' || t === 'sì' || t === 'ok';
}

export function isNo(text: string): boolean {
  const t = normalize(text);
  return t === 'no' || t === 'n';
}

export function extractImplicitCorrection(input: string): string | null {
  const t = String(input || '');
  // Pattern: "not X but Y"
  let m = t.match(/not\s+.+?\s+but\s+(.+)/i);
  if (m && m[1]) return m[1].trim();
  // Pattern: "intendevo Y" or "correggo: Y"
  m = t.match(/\b(intendevo|correggo)[:\s]+(.+)/i);
  if (m && m[2]) return m[2].trim();
  return null;
}

// Deprecated: use parsers/registry.ts (date)
export function extractLastDate(input: string): string | null {
  const re = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(String(input || ''))) !== null) last = m;
  return last ? `${last[1]}/${last[2]}/${last[3]}` : null;
}


