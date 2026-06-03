/**
 * ElevenLabs ConvAI knowledge base: create, update, delete (proxy Omnia → ConvAI KB API).
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

/** Aggiorna documento KB remoto (testo) — PATCH content su ElevenLabs. */
export async function updateConvaiKbDocumentFromText(
  documentationId: string,
  params: { name: string; text: string }
): Promise<void> {
  const id = String(documentationId ?? '').trim();
  if (!id) throw new Error('updateKbDocument: documentationId mancante.');
  const name = String(params.name ?? '').trim() || 'Omnia KB document';
  const content = String(params.text ?? '').trim();
  if (!content) throw new Error('updateKbDocument: testo vuoto.');
  const url = `/elevenlabs/knowledge-base/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      bodyText.trim()
        ? `updateKbDocument: HTTP ${res.status} — ${bodyText.trim().slice(0, 400)}`
        : `updateKbDocument: HTTP ${res.status}`
    );
  }
}

export type ConvaiKbListItem = {
  id: string;
  name: string;
  type?: string;
};

function pickKbListItem(entry: unknown): ConvaiKbListItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const o = entry as Record<string, unknown>;
  const id = pickKbDocumentId(o);
  if (!id) return null;
  const name = pickKbDocumentName(o, '');
  return {
    id,
    name,
    ...(typeof o.type === 'string' && o.type.trim() ? { type: o.type.trim() } : {}),
  };
}

/** Elenco documenti KB ConvAI (paginato). */
export async function listConvaiKbDocuments(params?: {
  pageSize?: number;
  cursor?: string | null;
  search?: string | null;
}): Promise<{ documents: ConvaiKbListItem[]; nextCursor: string | null; hasMore: boolean }> {
  const q = new URLSearchParams();
  const ps = params?.pageSize ?? 100;
  q.set('page_size', String(Math.min(100, Math.max(1, ps))));
  if (params?.cursor?.trim()) q.set('cursor', params.cursor.trim());
  if (params?.search?.trim()) q.set('search', params.search.trim());
  const url = `/elevenlabs/knowledge-base?${q.toString()}`;
  const res = await fetch(url, { method: 'GET' });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      bodyText.trim()
        ? `listKbDocuments: HTTP ${res.status} — ${bodyText.trim().slice(0, 400)}`
        : `listKbDocuments: HTTP ${res.status}`
    );
  }
  let data: Record<string, unknown> = {};
  try {
    data = bodyText.trim() ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`listKbDocuments: risposta non JSON (${res.status})`);
  }
  const rawDocs = Array.isArray(data.documents) ? data.documents : [];
  const documents = rawDocs
    .map((entry) => pickKbListItem(entry))
    .filter((x): x is ConvaiKbListItem => x !== null);
  const nextCursor =
    typeof data.next_cursor === 'string' && data.next_cursor.trim()
      ? data.next_cursor.trim()
      : null;
  const hasMore = data.has_more === true;
  return { documents, nextCursor, hasMore };
}

/** Scarica tutte le pagine KB che matchano `search` (prefisso nome ElevenLabs). */
export async function listAllConvaiKbDocumentsBySearch(
  search: string
): Promise<ConvaiKbListItem[]> {
  const prefix = String(search ?? '').trim();
  if (!prefix) return [];
  const out: ConvaiKbListItem[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const page = await listConvaiKbDocuments({
      pageSize: 100,
      cursor,
      search: prefix,
    });
    for (const doc of page.documents) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      out.push(doc);
    }
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

/** Elimina documento KB remoto (force=true rimuove anche da agenti collegati). */
export async function deleteConvaiKbDocument(
  documentationId: string,
  options?: { force?: boolean }
): Promise<void> {
  const id = String(documentationId ?? '').trim();
  if (!id) throw new Error('deleteKbDocument: documentationId mancante.');
  const force = options?.force === true;
  const url = `/elevenlabs/knowledge-base/${encodeURIComponent(id)}${force ? '?force=true' : ''}`;
  const res = await fetch(url, { method: 'DELETE' });
  const bodyText = await res.text();
  // Idempotente: documento già assente (purge di id stale o delete manuale precedente).
  if (res.status === 404 || res.status === 204) return;
  if (!res.ok) {
    throw new Error(
      bodyText.trim()
        ? `deleteKbDocument: HTTP ${res.status} — ${bodyText.trim().slice(0, 400)}`
        : `deleteKbDocument: HTTP ${res.status}`
    );
  }
}
