/**
 * Client for project-scoped KB document repository API.
 */

import { readFetchJson } from '@utils/readFetchJson';

export type KbRepositoryDocumentMeta = {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  textPreview?: string;
  uploadedAt: string;
};

export type KbDocumentContentResponse = {
  success: boolean;
  meta: KbRepositoryDocumentMeta;
  text: string;
  truncated: boolean;
  totalChars: number;
  message?: string | null;
};

export async function uploadKbDocumentToProject(
  projectId: string,
  params: {
    name: string;
    mimeType: string;
    contentBase64: string;
    textPreview?: string;
    documentId?: string;
  }
): Promise<KbRepositoryDocumentMeta> {
  const pid = String(projectId || '').trim();
  if (!pid) throw new Error('projectId mancante');

  const controller = new AbortController();
  const timeoutMs = 45_000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encodeURIComponent(pid)}/kb-documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Upload KB scaduto dopo ${timeoutMs / 1000}s (backend non risponde?)`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
  const raw = await readFetchJson<{
    success?: boolean;
    error?: string;
    document?: KbRepositoryDocumentMeta;
  }>(res);
  if (!res.ok || !raw.success || !raw.document) {
    throw new Error(raw.error?.trim() || `Upload KB fallito (${res.status})`);
  }
  return raw.document;
}

export async function fetchKbDocumentContent(
  projectId: string,
  documentId: string,
  maxChars = 120_000
): Promise<KbDocumentContentResponse> {
  const pid = String(projectId || '').trim();
  const did = String(documentId || '').trim();
  if (!pid || !did) throw new Error('projectId o documentId mancante');

  const qs = new URLSearchParams({ maxChars: String(maxChars) });
  const res = await fetch(
    `/api/projects/${encodeURIComponent(pid)}/kb-documents/${encodeURIComponent(did)}/content?${qs}`
  );
  const raw = await readFetchJson<KbDocumentContentResponse & { error?: string }>(res);
  if (!res.ok || !raw.success) {
    throw new Error(raw.error?.trim() || `Lettura documento fallita (${res.status})`);
  }
  return raw;
}

/** URL to stream the original uploaded file (PDF, Word, etc.). */
export function kbDocumentFileUrl(projectId: string, documentId: string): string {
  const pid = String(projectId || '').trim();
  const did = String(documentId || '').trim();
  return `/api/projects/${encodeURIComponent(pid)}/kb-documents/${encodeURIComponent(did)}/file`;
}

export async function deleteKbDocumentFromProject(
  projectId: string,
  documentId: string
): Promise<void> {
  const pid = String(projectId || '').trim();
  const did = String(documentId || '').trim();
  if (!pid || !did) return;
  await fetch(
    `/api/projects/${encodeURIComponent(pid)}/kb-documents/${encodeURIComponent(did)}`,
    { method: 'DELETE' }
  );
}
