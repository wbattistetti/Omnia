/**
 * Normalizes HTTP error response bodies and unknown thrown values for logging and user-facing messages.
 * Backend often returns JSON `{ "error": "..." }` or `{ "message": "..." }` on 4xx/5xx; some paths throw plain objects.
 */

/** Extract a human-readable line from JSON bodies commonly used by this app's API. */
function detailFromParsedJson(j: unknown): string | null {
  if (!j || typeof j !== 'object') return null;
  const o = j as Record<string, unknown>;

  const err = o.error;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err != null && typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  const msg = o.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();

  const details = o.details;
  if (typeof details === 'string' && details.trim()) return details.trim();

  return null;
}

/**
 * Reads the response body (consumed) and returns a short string for logs and Error messages.
 * Handles JSON `{ error, message, details }`, plain text, and truncation.
 */
export async function readHttpErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text?.trim()) return res.statusText || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as unknown;
      const fromJson = detailFromParsedJson(j);
      if (fromJson) return fromJson;
    } catch {
      /* not JSON */
    }
    const t = text.trim();
    return t.length > 400 ? `${t.slice(0, 400)}…` : t;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

/**
 * Safe string for catch blocks: avoids `[object Object]` when the thrown value is not an `Error`.
 */
export function formatUnknownError(value: unknown): string {
  if (value === null || value === undefined) {
    return 'unknown error';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.message || value.name || 'Error';
  }
  if (typeof value === 'object') {
    const fromShape = detailFromParsedJson(value);
    if (fromShape) return fromShape;
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}
