/**
 * ElevenLabs ConvAI knowledge base document create (proxy Omnia → POST /convai/knowledge-base/text).
 */

function pickKbDocumentId(data: Record<string, unknown>): string {
  const candidates = [
    data.id,
    data.document_id,
    data.documentId,
    (data.document as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function pickKbDocumentName(data: Record<string, unknown>, fallback: string): string {
  const candidates = [data.name, (data.document as Record<string, unknown> | undefined)?.name];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return fallback;
}

/** Crea documento KB remoto da testo (analisi Omnia). */
export async function createConvaiKbDocumentFromText(params: {
  name: string;
  text: string;
}): Promise<{ id: string; name: string }> {
  const name = String(params.name ?? '').trim() || 'Omnia KB document';
  const text = String(params.text ?? '').trim();
  if (!text) throw new Error('createKbDocument: testo vuoto.');
  const url = '/elevenlabs/knowledge-base/text';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, text }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      bodyText.trim()
        ? `createKbDocument: HTTP ${res.status} — ${bodyText.trim().slice(0, 400)}`
        : `createKbDocument: HTTP ${res.status}`
    );
  }
  let data: Record<string, unknown> = {};
  try {
    data = bodyText.trim() ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`createKbDocument: risposta non JSON (${res.status})`);
  }
  const id = pickKbDocumentId(data);
  if (!id) {
    throw new Error('createKbDocument: risposta senza id documento.');
  }
  return { id, name: pickKbDocumentName(data, name) };
}
