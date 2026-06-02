/**
 * Builds user-facing error strings for Omnia ElevenLabs proxy calls (list/delete/create).
 * Preserves upstream JSON fields when present so provisioning failures are actionable in the debugger.
 */

/** Max length for embedded raw body snippets in thrown Error messages. */
const BODY_SNIPPET_MAX = 600;

function truncateSnippet(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return t.length > BODY_SNIPPET_MAX ? `${t.slice(0, BODY_SNIPPET_MAX)}…` : t;
}

/**
 * Estrae messaggio leggibile da corpi errore ElevenLabs (FastAPI `detail` string/array/object).
 * Usato anche quando il proxy Omnia incapsula il body upstream in `details`.
 */
export function extractElevenLabsUpstreamDetail(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const nested = extractElevenLabsUpstreamDetail(JSON.parse(trimmed) as unknown);
        if (nested) return nested;
      } catch {
        /* body non JSON */
      }
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      if (item && typeof item === 'object' && 'msg' in item) {
        const msg = String((item as { msg?: unknown }).msg ?? '').trim();
        if (msg) parts.push(msg);
      } else if (typeof item === 'string' && item.trim()) {
        parts.push(item.trim());
      }
    }
    return parts.join('; ');
  }

  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.msg === 'string' && o.msg.trim()) return o.msg.trim();
    if (typeof o.detail !== 'undefined') {
      const nested = extractElevenLabsUpstreamDetail(o.detail);
      if (nested) return nested;
    }
    if (typeof o.details !== 'undefined') {
      const nested = extractElevenLabsUpstreamDetail(o.details);
      if (nested) return nested;
    }
  }

  return '';
}

function resolveElevenLabsHttpDetail(data: Record<string, unknown>): string {
  const fromDetails = extractElevenLabsUpstreamDetail(data.details);
  if (fromDetails) return truncateSnippet(fromDetails);
  const fromDetail = extractElevenLabsUpstreamDetail(data.detail);
  if (fromDetail) return truncateSnippet(fromDetail);
  return '';
}

export function formatListAgentsHttpError(res: Response, requestUrl: string, responseText: string): string {
  const trimmed = responseText.trim();
  let data: Record<string, unknown> = {};
  if (trimmed) {
    try {
      data = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const snippet = trimmed.length > BODY_SNIPPET_MAX ? `${trimmed.slice(0, BODY_SNIPPET_MAX)}…` : trimmed;
      return `listAgents: HTTP ${res.status} ${res.statusText.trim()} — ${snippet || '(corpo vuoto)'} [GET ${requestUrl}]`;
    }
  }

  const err =
    typeof data.error === 'string' && data.error.trim()
      ? data.error.trim()
      : typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `HTTP ${res.status}`;
  const detail = resolveElevenLabsHttpDetail(data);
  const phase = typeof data.phase === 'string' && data.phase.trim() ? data.phase.trim() : '';
  const upstream =
    typeof data.statusCode === 'number'
      ? data.statusCode
      : typeof data.httpStatus === 'number'
        ? data.httpStatus
        : null;
  const apiBase =
    typeof data.elevenLabsApiBase === 'string' && data.elevenLabsApiBase.trim().length > 0
      ? data.elevenLabsApiBase.trim()
      : '';

  const parts: string[] = [`listAgents: ${err}`];
  if (phase) parts.push(`(${phase})`);
  if (upstream != null) parts.push(`upstream HTTP ${upstream}`);
  if (detail) parts.push(`— ${detail}`);
  if (apiBase) parts.push(`[ElevenLabs API base: ${apiBase}]`);
  parts.push(`[GET ${requestUrl}]`);
  return parts.join(' ');
}

export type ConvaiAgentHttpOperation = 'deleteAgent' | 'patchAgent';

export function formatConvaiAgentHttpError(
  operation: ConvaiAgentHttpOperation,
  res: Response,
  agentId: string,
  responseText: string
): string {
  const trimmed = responseText.trim();
  let data: Record<string, unknown> = {};
  if (trimmed) {
    try {
      data = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const snippet = trimmed.length > BODY_SNIPPET_MAX ? `${trimmed.slice(0, BODY_SNIPPET_MAX)}…` : trimmed;
      return `${operation}: HTTP ${res.status} — ${snippet || '(corpo vuoto)'} [agent ${agentId}]`;
    }
  }

  const err =
    typeof data.error === 'string' && data.error.trim()
      ? data.error.trim()
      : typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `HTTP ${res.status}`;
  const detail = resolveElevenLabsHttpDetail(data);
  const upstream =
    typeof data.statusCode === 'number'
      ? data.statusCode
      : typeof data.httpStatus === 'number'
        ? data.httpStatus
        : null;

  const parts: string[] = [`${operation}: ${err}`];
  if (upstream != null && upstream !== res.status) parts.push(`(upstream HTTP ${upstream})`);
  if (detail) parts.push(`— ${detail}`);
  parts.push(`[agent ${agentId}]`);
  return parts.join(' ');
}

/** @deprecated Prefer {@link formatConvaiAgentHttpError} with `deleteAgent`. */
export function formatDeleteAgentHttpError(res: Response, agentId: string, responseText: string): string {
  return formatConvaiAgentHttpError('deleteAgent', res, agentId, responseText);
}
