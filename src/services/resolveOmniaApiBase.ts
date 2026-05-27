/**
 * Base URL for Express API calls from the browser.
 *
 * Empty string → same-origin relative paths (`/api/...`), which works for:
 * - Omnia dev (Vite proxy to :3100)
 * - Review portal on the same Express host (`/review-portal/` + `/api/...`)
 *
 * Set `VITE_BACKEND_URL` at build time when the UI is hosted on a different origin
 * than the API (production split deploy).
 */

export function resolveOmniaApiBase(): string {
  const fromEnv =
    typeof import.meta !== 'undefined'
      ? String(import.meta.env?.VITE_BACKEND_URL ?? '').trim()
      : '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return '';
}
