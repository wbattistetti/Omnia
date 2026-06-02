/**
 * Normalizes KB document text for parsing and display (BOM, classic Mac/Windows line endings).
 */

/** Strip BOM and normalize CR/LF to LF. */
export function normalizeKbDocumentText(text: string): string {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/** Logical lines after {@link normalizeKbDocumentText}. */
export function splitKbDocumentLines(text: string): string[] {
  return normalizeKbDocumentText(text).split('\n');
}
