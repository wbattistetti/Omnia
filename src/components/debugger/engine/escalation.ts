import { ParseResult } from './types';

/**
 * Checks for escalation conditions: noInput (empty input) or noMatch (parse failed).
 * Returns escalation message or null if no escalation.
 */
export function checkEscalation(userInput: string, parseResult: ParseResult): string | null {
  if (!userInput.trim()) return 'No input detected (noInput escalation).';
  if (!parseResult.success) return 'Input not recognized (noMatch escalation).';
  return null;
}