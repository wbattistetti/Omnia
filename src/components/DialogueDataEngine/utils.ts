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


