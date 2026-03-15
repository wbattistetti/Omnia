// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { useGrammarStore } from '../core/state/grammarStore';
import { validateGrammar, isGrammarValid } from '../core/domain/validation';

/**
 * Hook for grammar validation
 * Returns validation errors and validity status
 */
export function useGrammarValidation() {
  const grammar = useGrammarStore(state => state.grammar);

  const validationErrors = useMemo(() => {
    if (!grammar) return [];
    return validateGrammar(grammar);
  }, [grammar]);

  const isValid = useMemo(() => {
    if (!grammar) return true;
    return isGrammarValid(grammar);
  }, [grammar]);

  const errors = useMemo(() => {
    return validationErrors.filter(e => e.type === 'error');
  }, [validationErrors]);

  const warnings = useMemo(() => {
    return validationErrors.filter(e => e.type === 'warning');
  }, [validationErrors]);

  return {
    validationErrors,
    isValid,
    errors,
    warnings,
  };
}
