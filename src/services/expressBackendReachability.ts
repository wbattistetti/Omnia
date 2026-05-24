/**
 * Circuit breaker leggero quando Express (:3100) non risponde — riduce poll e messaggi utili in UI.
 */

const DEFAULT_PAUSE_MS = 60_000;

let pausedUntilMs = 0;

/** Segnala backend down (503 proxy o 5xx). */
export function markExpressBackendUnavailable(httpStatus?: number): void {
  if (httpStatus == null || httpStatus >= 500 || httpStatus === 503) {
    pausedUntilMs = Date.now() + DEFAULT_PAUSE_MS;
  }
}

/** Segnala backend di nuovo raggiungibile. */
export function markExpressBackendAvailable(): void {
  pausedUntilMs = 0;
}

export function isExpressBackendPaused(): boolean {
  return Date.now() < pausedUntilMs;
}

export const EXPRESS_BACKEND_UNAVAILABLE_MESSAGE =
  'Backend Express non raggiungibile su 127.0.0.1:3100. Avvia npm run dev:beNew o npm run dev:allNew; con dev:beNew serve anche Vite (npm run dev:vite) su :5173.';

/**
 * Estrae messaggio leggibile da risposta API (JSON o testo).
 */
export function parseExpressApiErrorBody(status: number, raw: string): string {
  const trimmed = raw.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as { message?: string; error?: string };
      if (parsed.message?.trim()) return parsed.message.trim();
      if (parsed.error === 'backend_unavailable') return EXPRESS_BACKEND_UNAVAILABLE_MESSAGE;
    } catch {
      if (trimmed.length < 400) return trimmed;
    }
  }
  if (status === 503 || status === 500) return EXPRESS_BACKEND_UNAVAILABLE_MESSAGE;
  return `Errore server (${status})`;
}
