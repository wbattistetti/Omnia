/**
 * Parses KB IA HTTP responses: prefers raw Markdown body; falls back to legacy JSON `{ markdown }`.
 */

export function parseKbMarkdownHttpBody(
  raw: string,
  contentType: string,
  ok: boolean
): { markdown?: string; error?: string; success?: boolean } {
  const trimmed = raw.trim();
  const ct = contentType.toLowerCase();

  if (!trimmed) {
    return ok
      ? { success: false, error: 'Risposta IA vuota' }
      : { success: false, error: `HTTP error (empty body)` };
  }

  if (ct.includes('json') || trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as {
        success?: boolean;
        markdown?: string;
        error?: string;
      };
      return json;
    } catch {
      if (!ok) {
        return { success: false, error: trimmed.slice(0, 500) };
      }
    }
  }

  if (ok) {
    return { success: true, markdown: trimmed };
  }

  return { success: false, error: trimmed.slice(0, 500) };
}

/**
 * Reads Markdown text from a KB prompt HTTP response (Analyze / Aggrega / refine).
 */
export async function readKbMarkdownHttpResponse(res: Response): Promise<string> {
  const raw = await res.text();
  const parsed = parseKbMarkdownHttpBody(raw, res.headers.get('content-type') ?? '', res.ok);

  if (!res.ok || parsed.success === false) {
    throw new Error(parsed.error?.trim() || `HTTP ${res.status}`);
  }

  const markdown = typeof parsed.markdown === 'string' ? parsed.markdown.trim() : '';
  if (!markdown) {
    throw new Error('Risposta IA senza Markdown');
  }
  return markdown;
}
