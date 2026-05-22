/**
 * Token canale review per le API (header X-Review-Token).
 * Dev: Vite legge automaticamente backend/.env — nessun form per il designer.
 * Prod: VITE_AGENT_REVIEW_CHANNEL_TOKEN al build oppure ?token= (una volta).
 */

const STORAGE_KEY = 'omnia.reviewChannelToken';

/** Chiamare una volta all'avvio (main.tsx) per leggere ?token= dall'URL. */
export function initReviewAuthFromLocation(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('token')?.trim();
  if (!fromUrl) return;

  sessionStorage.setItem(STORAGE_KEY, fromUrl);
  params.delete('token');
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', next);
}

export function setReviewAuthToken(token: string): void {
  const t = token.trim();
  if (t) sessionStorage.setItem(STORAGE_KEY, t);
  else sessionStorage.removeItem(STORAGE_KEY);
}

function tokenFromBuildEnv(): string {
  const explicit = String(import.meta.env.VITE_AGENT_REVIEW_CHANNEL_TOKEN ?? '').trim();
  if (explicit) return explicit;
  if (import.meta.env.DEV) {
    return String(import.meta.env.VITE_REVIEW_DEV_AUTO_TOKEN ?? '').trim();
  }
  return '';
}

export function reviewAuthToken(): string {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (stored) return stored;
  }
  return tokenFromBuildEnv();
}

export function isReviewTokenError(message: string): boolean {
  return message.includes('401') && message.includes('review_token_invalid');
}
