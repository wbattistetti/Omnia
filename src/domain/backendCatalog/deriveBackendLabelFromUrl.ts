/**
 * Default display name for a manual backend catalog row: last non-empty path segment of the URL.
 * User-editable label in UI overrides this; used when the label is still empty.
 */

const MAX_LEN = 120;

/**
 * Returns a short label derived from the URL path tail (e.g. `/api/v1/slots` → `slots`).
 * Falls back to hostname when the path has no segments. Empty string if input is unusable.
 */
export function deriveBackendLabelFromUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    const path = parsed.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      try {
        return decodeURIComponent(last).slice(0, MAX_LEN);
      } catch {
        return last.slice(0, MAX_LEN);
      }
    }
    const host = parsed.hostname.replace(/^www\./i, '');
    return host ? host.slice(0, MAX_LEN) : '';
  } catch {
    const noQuery = trimmed.split(/[?#]/)[0] ?? '';
    const parts = noQuery.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return '';
    try {
      return decodeURIComponent(last).slice(0, MAX_LEN);
    } catch {
      return last.slice(0, MAX_LEN);
    }
  }
}
