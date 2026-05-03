/**
 * Costruisce il fallback Test API dai soli letterali SEND (mapping): variabili di flusso non sono risolvibili qui.
 */

export function buildLiteralFallbackFromSendMapping(
  entries: Array<{ wireKey?: string; literalConstant?: string }>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    const w = e.wireKey?.trim();
    if (!w) continue;
    const lit = e.literalConstant?.trim();
    if (lit) out[w] = lit;
  }
  return out;
}
