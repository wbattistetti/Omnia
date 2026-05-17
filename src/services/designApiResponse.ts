/**
 * Safe JSON parsing for /design/* API responses (Node backend via Vite proxy).
 * Avoids opaque "Unexpected end of JSON input" when the proxy or server returns an empty body.
 */

function backendReachabilityHint(status: number): string {
  if (status === 502 || status === 503 || status === 504 || status === 0) {
    return ' Verifica che il backend Express sia avviato (es. `npm run dev:beNew` o `npm run dev:allNew`, porta 3100).';
  }
  if (status >= 500) {
    return ' Controlla i log del terminale backend.';
  }
  return '';
}

/**
 * Read response body as text and parse JSON; fail with a designer-facing message if empty or invalid.
 */
export async function parseDesignApiJsonResponse<T = unknown>(res: Response): Promise<T> {
  let text = '';
  try {
    text = await res.text();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Impossibile leggere la risposta del server (HTTP ${res.status}): ${detail}.${backendReachabilityHint(res.status)}`
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(
      `Risposta vuota dal server (HTTP ${res.status}). La connessione può essersi interrotta durante la generazione IA.${backendReachabilityHint(res.status)}`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(
      `Risposta non JSON dal server (HTTP ${res.status}): «${preview}${trimmed.length > 160 ? '…' : ''}».${backendReachabilityHint(res.status)}`
    );
  }
}
