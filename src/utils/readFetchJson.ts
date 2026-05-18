/**
 * Safe JSON parsing for fetch responses (handles empty body / non-JSON errors).
 */

export async function readFetchJson<T extends Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? `Risposta vuota dal server (${res.status})`
        : `Errore HTTP ${res.status}: risposta vuota`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Risposta non JSON (${res.status}): ${text.slice(0, 200)}`
    );
  }
}
