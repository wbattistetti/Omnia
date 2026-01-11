import { useState, useEffect, useRef } from 'react';

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

  // Get all sub-data/subSlots
  const allSubs = [...(node.subSlots || []), ...(node.subData || [])];
  result.groupsExpected = allSubs.length;

  if (allSubs.length === 0) {
    // No sub-data, regex doesn't need capture groups
    result.valid = true;
    return result;
  }

  try {
    // Count capture groups in regex (excluding non-capturing groups like (?: ...))
    // Pattern: ( ... ) but not (?: ...) or (?= ...) or (?! ...)
    const capturingGroupPattern = /\((?!\?[:=!])[^)]*\)/g;
    const matches = regex.match(capturingGroupPattern);

    if (!matches || matches.length === 0) {
      result.valid = false;
      result.errors.push(`No capture groups found. Expected ${allSubs.length} capture groups for: ${allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ')}`);
      return result;
    }

    result.groupsFound = matches.length;

    // Test regex with a sample input to see what groups actually match
    // For dates, try a sample date string
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
      result.warnings.push('Regex does not match test input - cannot validate capture groups');
      // Still validate structure
    } else {
      // Filter out undefined/null groups
      const actualGroups = testMatch.slice(1).filter((g: string | undefined) => g !== undefined && g !== null && String(g).trim().length > 0);
      result.groupsFound = actualGroups.length;
    }

    // Validate group count
    if (result.groupsFound < result.groupsExpected) {
      result.valid = false;
      const expectedLabels = allSubs.slice(result.groupsFound).map((s: any) => {
        const standardKey = mapLabelToStandardKey(s.label || s.name || '');
        return standardKey || (s.label || s.name || 'sub-data');
      }).join(', ');
      result.errors.push(`Found ${result.groupsFound} capture groups but need ${result.groupsExpected}. Missing groups for: ${expectedLabels}`);
    } else if (result.groupsFound > result.groupsExpected) {
      result.warnings.push(`Found ${result.groupsFound} capture groups but only ${result.groupsExpected} sub-data expected. Extra groups may cause mapping issues.`);
    }

    // Validate group positions (if we have a test match)
    if (testMatch && result.groupsFound > 0) {
      const actualGroups = testMatch.slice(1).filter((g: string | undefined) => g !== undefined && g !== null);

      for (let i = 0; i < Math.min(actualGroups.length, allSubs.length); i++) {
        const groupValue = actualGroups[i]?.trim() || '';
        const subData = allSubs[i];
        const subLabel = String(subData.label || subData.name || '');
        const standardKey = mapLabelToStandardKey(subLabel);

        if (standardKey === 'day' || standardKey === 'month' || standardKey === 'year') {
          // Should be numeric
          const numValue = parseInt(groupValue, 10);
          if (isNaN(numValue)) {
            result.errors.push(`Group ${i + 1} (for '${subLabel}') contains '${groupValue}' which is not numeric. Expected number for ${standardKey}.`);
            result.valid = false;
          }
        }

        // Check for separators in wrong positions
        if (groupValue.length === 1 && /[-/.\s]/.test(groupValue)) {
          const expectedStandardKey = mapLabelToStandardKey(subLabel);
          if (expectedStandardKey && (expectedStandardKey === 'day' || expectedStandardKey === 'month' || expectedStandardKey === 'year')) {
            result.errors.push(`Group ${i + 1} contains separator '${groupValue}' instead of value for '${subLabel}' (${expectedStandardKey})`);
            result.valid = false;
          }
        }
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

  // ✅ Validate when regex changes (manual edits)
  useEffect(() => {
    if (shouldValidateOnChange && regex && regex.trim().length > 0) {
      const validation = validateRegexGroups(regex, node);
      setValidationResult(validation);
      setShouldShowValidation(true);
    } else if (!regex || regex.trim().length === 0) {
      // Clear validation when regex is empty
      setValidationResult(null);
      setShouldShowValidation(false);
    }
  }, [regex, node, shouldValidateOnChange]);

  // ✅ Validate when AI finishes generating
  useEffect(() => {
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
