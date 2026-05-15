/**
 * Normalize any http(s) URL to portal origin `scheme://host[:port]`.
 */

export function normalizePortalOrigin(url: string): string {
  const raw = (url || '').trim();
  if (!raw) throw new Error('URL vuoto');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('URL non valido');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Servono URL http o https');
  }
  return `${parsed.protocol}//${parsed.host}`;
}
