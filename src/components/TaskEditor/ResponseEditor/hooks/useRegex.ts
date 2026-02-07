// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useRegex - Composite Hook
 *
 * Orchestrates regex state and validation functionality:
 * - State management (from useRegexState)
 * - Validation (from useRegexValidation)
 *
 * ✅ FASE 2.2: Consolidated from useRegexState + useRegexValidation into 1 composite hook
 * Note: useRegexAIGeneration remains separate (it's a distinct feature)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import nlpTypesConfig from '@config/nlp-types.json';
import { getIsTesting } from '@responseEditor/testingState';
import { useNotesStore } from '@responseEditor/features/step-management/stores/notesStore';
import { validateNamedGroups, extractNamedGroupsFromRegex } from '@responseEditor/utils/regexGroupUtils';
import type { TaskTreeNode } from '@types/taskTypes';

// ============================================
// Types and Interfaces
// ============================================

export interface ValidationResult {
  valid: boolean;
  groupsFound: number;
  groupsExpected: number;
  errors: string[];
  warnings: string[];
}

export interface UseRegexOptions {
  initialRegex: string;
  examplesList?: string[];
  node?: any;
  shouldValidateOnChange?: boolean;
  shouldValidateOnAIFinish?: boolean;
  generatingRegex?: boolean;
}

export interface UseRegexResult {
  // State (from useRegexState)
  baselineRegex: string;
  currentText: string;
  isDirty: boolean;
  updateBaseline: (generatedRegex: string) => void;
  updateCurrentText: (newText: string) => void;

  // Validation (from useRegexValidation)
  validationResult: ValidationResult | null;
  shouldShowValidation: boolean;
  setShouldShowValidation: React.Dispatch<React.SetStateAction<boolean>>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Simple hash function for tester notes
 */
function hashNotes(notes: Record<string, string>): string {
  const sortedKeys = Object.keys(notes).sort();
  const content = sortedKeys.map(k => `${k}:${notes[k]}`).join('|');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Helper to map label to standard key
 */
function mapLabelToStandardKey(label: string): string | null {
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

/**
 * Validate regex capture groups against expected sub-data
 */
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
    result.valid = true;
    return result;
  }

  const subNodes = (node as TaskTreeNode).subNodes || node.subData || node.subSlots || [];
  result.groupsExpected = subNodes.length;

  if (subNodes.length === 0) {
    result.valid = true;
    return result;
  }

  try {
    const namedGroupsValidation = validateNamedGroups(regex, subNodes as TaskTreeNode[]);
    result.groupsFound = namedGroupsValidation.groupsFound;
    result.valid = namedGroupsValidation.valid;
    result.errors = [...namedGroupsValidation.errors];
    result.warnings = [...namedGroupsValidation.warnings];

    let testString = '';
    if (node.kind === 'date' || (node.label && /date|data/i.test(node.label))) {
      testString = '16/12/1980';
    } else {
      testString = 'test input';
    }

    const regexObj = new RegExp(regex);
    const testMatch = testString.match(regexObj);

    if (!testMatch) {
      result.warnings.push('Regex does not match test input - cannot validate extraction');
    } else if (testMatch.groups) {
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

// ============================================
// Main Hook
// ============================================

/**
 * Composite hook that combines regex state and validation.
 * Consolidates useRegexState and useRegexValidation.
 */
export function useRegex({
  initialRegex,
  examplesList = [],
  node,
  shouldValidateOnChange = true,
  shouldValidateOnAIFinish = true,
  generatingRegex = false,
}: UseRegexOptions): UseRegexResult {
  // ============================================
  // State Management (from useRegexState)
  // ============================================
  const allNotes = useNotesStore((s) => s.notes);

  const getAllRegexNotes = useCallback((): Record<string, string> => {
    const regexNotes: Record<string, string> = {};
    Object.entries(allNotes).forEach(([key, value]) => {
      if (key.endsWith('|regex')) {
        regexNotes[key] = value;
      }
    });
    return regexNotes;
  }, [allNotes]);

  const [baselineRegex, setBaselineRegex] = useState(() => initialRegex || '');
  const [currentText, setCurrentText] = useState(() => initialRegex || '');
  const [baselineTesterNotesHash, setBaselineTesterNotesHash] = useState<string>('');
  const [currentTesterNotesHash, setCurrentTesterNotesHash] = useState<string>('');

  useEffect(() => {
    const initialNotes = getAllRegexNotes();
    const initialHash = hashNotes(initialNotes);
    setBaselineTesterNotesHash(initialHash);
    setCurrentTesterNotesHash(initialHash);
  }, []);

  useEffect(() => {
    const notes = getAllRegexNotes();
    const newHash = hashNotes(notes);
    setCurrentTesterNotesHash(newHash);
  }, [allNotes, getAllRegexNotes]);

  const isDirty = useMemo(() => {
    return currentText !== baselineRegex ||
           currentTesterNotesHash !== baselineTesterNotesHash;
  }, [currentText, baselineRegex, currentTesterNotesHash, baselineTesterNotesHash]);

  const updateBaseline = useCallback((generatedRegex: string) => {
    setBaselineRegex(generatedRegex);
    setCurrentText(generatedRegex);
    setBaselineTesterNotesHash(currentTesterNotesHash);
  }, [currentTesterNotesHash]);

  const updateCurrentText = useCallback((newText: string) => {
    setCurrentText(newText);
  }, []);

  // ============================================
  // Validation (from useRegexValidation)
  // ============================================
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [shouldShowValidation, setShouldShowValidation] = useState(false);
  const prevGeneratingRegex = useRef(generatingRegex);
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate when regex changes (manual edits) - DEBOUNCED
  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    if (shouldValidateOnChange && currentText && currentText.trim().length > 0) {
      validationTimeoutRef.current = setTimeout(() => {
        if (getIsTesting()) {
          validationTimeoutRef.current = null;
          return;
        }
        const validation = validateRegexGroups(currentText, node);
        setValidationResult(validation);
        setShouldShowValidation(true);
        validationTimeoutRef.current = null;
      }, 300);
    } else if (!currentText || currentText.trim().length === 0) {
      setValidationResult(null);
      setShouldShowValidation(false);
    }

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
    };
  }, [currentText, node, shouldValidateOnChange]);

  // Validate when AI finishes generating
  useEffect(() => {
    if (getIsTesting()) {
      return;
    }

    if (shouldValidateOnAIFinish && prevGeneratingRegex.current && !generatingRegex && currentText && currentText.trim().length > 0) {
      const validation = validateRegexGroups(currentText, node);
      setValidationResult(validation);
      setShouldShowValidation(true);
      console.log('[AI Regex] ✅ AI finished, validation result:', validation);
    }
    prevGeneratingRegex.current = generatingRegex;
  }, [generatingRegex, currentText, node, shouldValidateOnAIFinish]);

  return {
    // State
    baselineRegex,
    currentText,
    isDirty,
    updateBaseline,
    updateCurrentText,
    // Validation
    validationResult,
    shouldShowValidation,
    setShouldShowValidation,
  };
}
