import { useState, useEffect, useRef } from 'react';
import nlpTypesConfig from '@config/nlp-types.json';
import { getIsTesting } from '@responseEditor/testingState';
import { validateNamedGroups, extractNamedGroupsFromRegex } from '@responseEditor/utils/regexGroupUtils';
import type { TaskTreeNode } from '@types/taskTypes';

// Validate regex capture groups against expected sub-data
export interface ValidationResult {
  valid: boolean;
  groupsFound: number;
  groupsExpected: number;
  errors: string[];
  warnings: string[];
}

// Helper to map label to standard key (same logic as pipeline.ts)
export function mapLabelToStandardKey(label: string): string | null {
  const normalized = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (normalized.includes('day') || normalized.includes('giorno')) return 'day';
  if (normalized.includes('month') || normalized.includes('mese')) return 'month';
  if (normalized.includes('year') || normalized.includes('anno')) return 'year';
  if (normalized.includes('first') || normalized.includes('nome') || normalized.includes('firstname')) return 'firstname';
  if (normalized.includes('last') || normalized.includes('cognome') || normalized.includes('surname') || normalized.includes('lastname')) return 'lastname';
  if (normalized.includes('street') || normalized.includes('via') || normalized.includes('indirizzo')) return 'street';
  if (normalized.includes('city') || normalized.includes('citta') || normalized.includes('comune')) return 'city';
  if (normalized.includes('zip') || normalized.includes('cap') || normalized.includes('postal')) return 'zip';
  if (normalized.includes('country') || normalized.includes('nazione') || normalized.includes('paese')) return 'country';
  return null;
}

function validateRegexGroups(regex: string | undefined, node: any): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    groupsFound: 0,
    groupsExpected: 0,
    errors: [],
    warnings: []
  };

  if (!regex || !regex.trim()) {
    result.valid = false;
    result.errors.push('Regex is empty');
    return result;
  }

  if (!node) {
    // No sub-data to validate against
    result.valid = true;
    return result;
  }

  // ✅ Use subNodes if available, otherwise fallback to subData/subSlots for backward compatibility
  const subNodes = (node as TaskTreeNode).subNodes || node.subData || node.subSlots || [];
  result.groupsExpected = subNodes.length;

  if (subNodes.length === 0) {
    // No sub-data, regex doesn't need capture groups
    result.valid = true;
    return result;
  }

  try {
    // ✅ Validate named groups using regexGroupUtils
    const namedGroupsValidation = validateNamedGroups(regex, subNodes as TaskTreeNode[]);

    result.groupsFound = namedGroupsValidation.groupsFound;
    result.valid = namedGroupsValidation.valid;
    result.errors = [...namedGroupsValidation.errors];
    result.warnings = [...namedGroupsValidation.warnings];

    // ✅ Additional validation: test regex with sample input
    let testString = '';
    if (node.kind === 'date' || (node.label && /date|data/i.test(node.label))) {
      testString = '16/12/1980'; // Sample date
    } else {
      // Generic test - just create a string with some characters
      testString = 'test input';
    }

    const regexObj = new RegExp(regex);
    const testMatch = testString.match(regexObj);

    if (!testMatch) {
      result.warnings.push('Regex does not match test input - cannot validate extraction');
    } else if (testMatch.groups) {
      // ✅ Validate that named groups can extract values
      const extractedGroups = testMatch.groups;
      const extractedCount = Object.keys(extractedGroups).filter(key => extractedGroups[key] !== undefined && extractedGroups[key] !== null && String(extractedGroups[key]).trim().length > 0).length;

      if (extractedCount === 0 && subNodes.length > 0) {
        result.warnings.push('Named groups are present but no values were extracted from test input');
      }
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Error validating regex: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

interface UseRegexValidationOptions {
  regex: string;
  node?: any;
  shouldValidateOnChange?: boolean; // ✅ NEW: Validate also on manual changes
  shouldValidateOnAIFinish?: boolean; // Validate when AI finishes
  generatingRegex?: boolean; // Track AI generation state
}

/**
 * Hook to manage regex validation
 * Validates on manual changes AND when AI finishes generating
 */
export function useRegexValidation({
  regex,
  node,
  shouldValidateOnChange = true, // ✅ NEW: Default to true for new behavior
  shouldValidateOnAIFinish = true,
  generatingRegex = false,
}: UseRegexValidationOptions) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [shouldShowValidation, setShouldShowValidation] = useState(false);
  const prevGeneratingRegex = useRef(generatingRegex);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Validate when regex changes (manual edits) - DEBOUNCED per evitare flickering
  useEffect(() => {
    // Clear previous timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (shouldValidateOnChange && regex && regex.trim().length > 0) {
      // Debounce validation: wait 300ms after user stops typing
      validationTimeoutRef.current = setTimeout(() => {
        // ✅ Check testing state when timeout fires, not when effect runs
        if (getIsTesting()) {
          validationTimeoutRef.current = null;
          return;
        }
        const validation = validateRegexGroups(regex, node);
        setValidationResult(validation);
        setShouldShowValidation(true);
        validationTimeoutRef.current = null;
      }, 300);
    } else if (!regex || regex.trim().length === 0) {
      // Clear validation immediately when regex is empty
      setValidationResult(null);
      setShouldShowValidation(false);
    }

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
    };
  }, [regex, node, shouldValidateOnChange]);

  // ✅ Validate when AI finishes generating
  useEffect(() => {
    // ✅ Check testing state when effect runs
    if (getIsTesting()) {
      return;
    }

    if (shouldValidateOnAIFinish && prevGeneratingRegex.current && !generatingRegex && regex && regex.trim().length > 0) {
      const validation = validateRegexGroups(regex, node);
      setValidationResult(validation);
      setShouldShowValidation(true);
      console.log('[AI Regex] ✅ AI finished, validation result:', validation);
    }
    prevGeneratingRegex.current = generatingRegex;
  }, [generatingRegex, regex, node, shouldValidateOnAIFinish]);

  return {
    validationResult,
    shouldShowValidation,
    setShouldShowValidation,
  };
}
