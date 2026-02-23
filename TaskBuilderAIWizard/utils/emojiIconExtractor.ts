// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * ⚠️ NOTE: This file is simplified - we no longer extract emoji from labels.
 * The AI now returns emoji as a separate field.
 *
 * This file only contains stripEmojiFromLabel() as a safety net
 * in case the AI doesn't respect the prompt and puts emoji in labels.
 */

/**
 * Strip all emoji and problematic Unicode characters from a label
 *
 * @param label Label that may contain emoji
 * @returns Clean label with no emoji or problematic characters
 */
export function stripEmojiFromLabel(label: string): string {
  if (!label || typeof label !== 'string') {
    return label || '';
  }

  // Remove ALL emoji using comprehensive Unicode ranges
  let cleaned = label
    // Emoji ranges (most comprehensive)
    .replace(/[\u{1F000}-\u{1F9FF}]/gu, '') // All emoji
    .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical symbols
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    // Surrogate pairs
    .replace(/[\u{D800}-\u{DFFF}]/gu, '')
    // Zero-width characters
    .replace(/[\u{200B}-\u{200D}]/gu, '')
    .replace(/[\u{FEFF}]/gu, '')
    // Control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim();

  return cleaned;
}
