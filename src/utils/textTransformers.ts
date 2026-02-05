/**
 * textTransformers.ts
 *
 * Utility functions for transforming text in a friendly, conversational way.
 * Used primarily for wizard UI micro-copy.
 */

/**
 * Transforms "chiedi X" to "chiedere X" in a deterministic way.
 *
 * Examples:
 * - "Chiedi la data di nascita" → "chiedere la data di nascita"
 * - "chiedi il nome" → "chiedere il nome"
 * - "Chiedi X" → "chiedere X"
 *
 * @param text - The text to transform
 * @returns The transformed text
 */
export function transformTaskLabelToFriendly(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  // Normalize: trim and lowercase for matching
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Pattern: "chiedi" at the start (case insensitive)
  const chiediPattern = /^chiedi\s+/i;

  if (chiediPattern.test(trimmed)) {
    // Replace "chiedi" with "chiedere" (preserve original case of rest)
    return trimmed.replace(chiediPattern, (match) => {
      // Preserve case: if original was "Chiedi" → "Chiedere", if "chiedi" → "chiedere"
      const firstChar = match[0];
      const isUpperCase = firstChar === firstChar.toUpperCase();
      return isUpperCase ? 'Chiedere ' : 'chiedere ';
    });
  }

  // No transformation needed
  return trimmed;
}

/**
 * Generates a friendly message for the compact wizard step.
 * Returns an object with the message parts for rendering with bold text.
 *
 * @param taskLabel - The task label (e.g., "Chiedi la data di nascita")
 * @returns Object with message parts: { prefix, boldPart, suffix }
 */
export function generateFriendlyWizardMessage(taskLabel: string): { prefix: string; boldPart: string; suffix: string } {
  // Transform to lowercase "chiedere" format
  const transformed = transformTaskLabelToFriendly(taskLabel);
  // Force lowercase for the bold part
  const boldPart = transformed.toLowerCase();

  return {
    prefix: 'Non sono riuscito a trovare un modulo adatto per',
    boldPart: boldPart,
    suffix: '.\nProva a vedere se tra quelli disponibili qui sotto ce n\'è uno che fa al caso tuo:'
  };
}
