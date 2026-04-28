/**
 * Builds user-facing error strings for Omnia ElevenLabs proxy calls (list/delete/create).
 * Preserves upstream JSON fields when present so provisioning failures are actionable in the debugger.
 */

/** Max length for embedded raw body snippets in thrown Error messages. */
const BODY_SNIPPET_MAX = 600;

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
  const detailRaw =
    typeof data.details === 'string'
      ? data.details
      : typeof data.detail === 'string'
        ? data.detail
        : '';
  const detail = detailRaw.trim()
    ? detailRaw.length > BODY_SNIPPET_MAX
      ? `${detailRaw.slice(0, BODY_SNIPPET_MAX)}…`
      : detailRaw
    : '';
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

export function formatDeleteAgentHttpError(res: Response, agentId: string, responseText: string): string {
  const trimmed = responseText.trim();
  let data: Record<string, unknown> = {};
  if (trimmed) {
    try {
      data = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const snippet = trimmed.length > BODY_SNIPPET_MAX ? `${trimmed.slice(0, BODY_SNIPPET_MAX)}…` : trimmed;
      return `deleteAgent: HTTP ${res.status} — ${snippet || '(corpo vuoto)'} [agent ${agentId}]`;
    }
  }

  const err =
    typeof data.error === 'string' && data.error.trim()
      ? data.error.trim()
      : typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `HTTP ${res.status}`;
  const detailRaw =
    typeof data.details === 'string'
      ? data.details
      : typeof data.detail === 'string'
        ? data.detail
        : '';
  const detail = detailRaw.trim()
    ? detailRaw.length > BODY_SNIPPET_MAX
      ? `${detailRaw.slice(0, BODY_SNIPPET_MAX)}…`
      : detailRaw
    : '';

  return detail ? `deleteAgent: ${err} — ${detail}` : `deleteAgent: ${err}`;
}
