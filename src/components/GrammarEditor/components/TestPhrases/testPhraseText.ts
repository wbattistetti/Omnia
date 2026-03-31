/**
 * Normalization for duplicate detection of grammar test phrases (trim + case fold).
 */
export function normalizePhraseForDedup(s: string): string {
  return s.trim().toLowerCase();
}
