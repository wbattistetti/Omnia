/**
 * Root composer draft: newline, comma, or semicolon separates multiple root use cases (batch on Enter).
 */

/** Max root use cases per Enter (fail-fast guardrail). */
export const ROOT_USE_CASE_BATCH_MAX = 30;

/** Split on line breaks (list pasted one scenario per line), comma, or semicolon. */
const ROOT_BATCH_SPLIT = /[;,\r\n]+/;

/**
 * Splits draft text into segment labels (trimmed, non-empty).
 * Each physical line is typically one scenario; `,` / `;` also split (batch on same line).
 */
export function parseRootUseCaseDraftSegments(raw: string): string[] {
  return String(raw || '')
    .split(ROOT_BATCH_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Collapses separators into one segment per line for readable textarea display.
 */
export function normalizeRootUseCaseDraftDisplay(raw: string): string {
  return parseRootUseCaseDraftSegments(raw).join('\n');
}
