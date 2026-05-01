/**
 * Chiave canonica per deduplica catalogo: metodo + path (+ operationId opzionale).
 *
 * Edge cases (JSDoc contratto):
 * - Query string: **esclusa** dalla chiave — due URL stesso path/query diversa → stessa riga aggregata.
 * - Host: incluso nell’origine — `localhost` vs `127.0.0.1` sono chiavi diverse (ambienti distinti).
 * - Path trailing slash: normalizzato — `/a` e `/a/` equivalgono.
 * - Case path: **non** forziamo lowercase (API REST case-sensitive).
 */

/** Normalizza pathname: no trailing slash eccetto root. */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/$/, '') || '/';
}

export function normalizeMethod(method: string): string {
  return method.trim().toUpperCase();
}

/**
 * Impronta strutturale endpoint per confronto stale (senza OpenAPI).
 * Usare dopo normalizzazione URL assoluta.
 */
export function structuralFingerprint(method: string, absoluteUrl: string): string {
  try {
    const u = new URL(absoluteUrl);
    return `${normalizeMethod(method)}|${u.origin}${normalizePathname(u.pathname)}`;
  } catch {
    return `${normalizeMethod(method)}|${absoluteUrl.trim()}`;
  }
}

export type CanonicalKeyInput = {
  method: string;
  /** URL assoluto o documento OpenAPI */
  endpointUrl: string;
  operationId?: string;
};

/**
 * Chiave univoca logica per merge righe catalogo.
 * Con `operationId` disambigua due operazioni distinte sullo stesso path+method.
 */
export function canonicalKey(input: CanonicalKeyInput): string {
  const m = normalizeMethod(input.method);
  let pathPart = '';
  try {
    const u = new URL(input.endpointUrl);
    pathPart = `${u.origin}${normalizePathname(u.pathname)}`;
  } catch {
    pathPart = input.endpointUrl.trim();
  }
  const op = input.operationId?.trim();
  return op ? `${m}|${pathPart}|op:${op}` : `${m}|${pathPart}`;
}
