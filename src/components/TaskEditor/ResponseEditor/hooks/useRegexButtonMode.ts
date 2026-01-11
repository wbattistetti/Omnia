import { useMemo } from 'react';
import { ValidationResult } from './useRegexValidation';

interface UseRegexButtonModeOptions {
  regex: string;
  hasUserEdited: boolean;
  validationResult: ValidationResult | null;
  placeholderText?: string;
}

/**
 * Hook to determine Create vs Refine button mode for regex editor
 *
 * Rules:
 * - "Create Regex" if: regex is empty AND no validation errors
 * - "Refine Regex" if: regex is not empty AND (user edited OR has validation errors)
 */
export function useRegexButtonMode({
  regex,
  hasUserEdited,
  validationResult,
  placeholderText = "scrivi l'espressione regolare che ti serve",
}: UseRegexButtonModeOptions) {
  const isRegexEmpty = useMemo(() => {
    return !regex || regex.trim().length === 0 || regex.trim() === placeholderText;
  }, [regex, placeholderText]);

  const hasValidationErrors = useMemo(() => {
    return validationResult !== null && !validationResult.valid && validationResult.errors.length > 0;
  }, [validationResult]);

  // ✅ Create mode: regex is empty AND no validation errors
  const isCreateMode = useMemo(() => {
    return isRegexEmpty && !hasUserEdited && !hasValidationErrors;
  }, [isRegexEmpty, hasUserEdited, hasValidationErrors]);

  // ✅ Refine mode: regex is not empty AND (user edited OR has validation errors)
  const isRefineMode = useMemo(() => {
    return !isRegexEmpty && (hasUserEdited || hasValidationErrors);
  }, [isRegexEmpty, hasUserEdited, hasValidationErrors]);

  // ✅ Show button if:
  // - regex is empty (to create)
  // - OR user has edited (to refine)
  // - OR there are validation errors (to refine)
  const shouldShowButton = useMemo(() => {
    return isRegexEmpty || hasUserEdited || hasValidationErrors;
  }, [isRegexEmpty, hasUserEdited, hasValidationErrors]);

  return {
    isCreateMode,
    isRefineMode,
    shouldShowButton,
    isRegexEmpty,
    hasValidationErrors,
  };
}
