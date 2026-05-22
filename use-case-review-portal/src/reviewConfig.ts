/**
 * Config portale review (env Vite, non form utente).
 */

export { initReviewAuthFromLocation, reviewAuthToken, setReviewAuthToken, isReviewTokenError } from './reviewAuth';

export function reviewApiBase(): string {
  const raw = String(import.meta.env.VITE_REVIEW_API_BASE ?? '').trim();
  return raw.replace(/\/$/, '');
}
