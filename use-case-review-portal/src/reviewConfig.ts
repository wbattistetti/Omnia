/**
 * Config portale review (env Vite, non form utente).
 */

export function reviewApiBase(): string {
  const raw = String(import.meta.env.VITE_REVIEW_API_BASE ?? '').trim();
  return raw.replace(/\/$/, '');
}

export function reviewAuthToken(): string {
  return String(import.meta.env.VITE_AGENT_REVIEW_CHANNEL_TOKEN ?? '').trim();
}
