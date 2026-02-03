// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';

interface UseRegexButtonModeOptions {
  baselineRegex: string;
  isDirty: boolean;
  hasValidationErrors?: boolean; // ✅ NEW: Include validation errors
}

/**
 * Simple button mode hook
 * Model: One button with dynamic caption
 * - if baselineRegex === "" → "Create Regex"
 * - else → "Refine Regex"
 * - enabled = isDirty OR hasValidationErrors
 */
export function useRegexButtonMode({
  baselineRegex,
  isDirty,
  hasValidationErrors = false, // ✅ NEW: Default to false
}: UseRegexButtonModeOptions) {
  const buttonCaption = useMemo(() => {
    return baselineRegex === '' ? 'Create Regex' : 'Refine Regex';
  }, [baselineRegex]);

  // ✅ Button enabled if dirty OR has validation errors
  const buttonEnabled = useMemo(() => {
    return isDirty || hasValidationErrors;
  }, [isDirty, hasValidationErrors]);

  return {
    buttonCaption,
    buttonEnabled,
    isCreateMode: baselineRegex === '',
  };
}
