// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNotesStore } from '@responseEditor/stores/notesStore';

/**
 * Simple hash function for tester notes
 * Creates a stable hash from notes object
 */
function hashNotes(notes: Record<string, string>): string {
  const sortedKeys = Object.keys(notes).sort();
  const content = sortedKeys.map(k => `${k}:${notes[k]}`).join('|');
  // Simple hash: sum of char codes (sufficient for dirty detection)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

interface UseRegexStateOptions {
  initialRegex: string;
  examplesList?: string[];
}

/**
 * Simple state management for regex editor
 * Model: baselineRegex, currentText, baselineTesterNotesHash, currentTesterNotesHash
 * Dirty flag: (currentText !== baselineRegex) OR (currentTesterNotesHash !== baselineTesterNotesHash)
 */
export function useRegexState({ initialRegex, examplesList = [] }: UseRegexStateOptions) {
  // Subscribe to notes store to get all notes
  const allNotes = useNotesStore((s) => s.notes);

  // Get all notes from store (filter for regex method only)
  const getAllRegexNotes = useCallback((): Record<string, string> => {
    const regexNotes: Record<string, string> = {};

    // Filter notes for regex method only
    Object.entries(allNotes).forEach(([key, value]) => {
      if (key.endsWith('|regex')) {
        regexNotes[key] = value;
      }
    });

    return regexNotes;
  }, [allNotes]);

  // ✅ State variables - initialize with stable values to prevent flickering
  const [baselineRegex, setBaselineRegex] = useState(() => initialRegex || '');
  const [currentText, setCurrentText] = useState(() => initialRegex || '');

  // Hash for tester notes - use state to make it reactive
  const [baselineTesterNotesHash, setBaselineTesterNotesHash] = useState<string>('');
  const [currentTesterNotesHash, setCurrentTesterNotesHash] = useState<string>('');

  // Initialize hashes on mount
  useEffect(() => {
    const initialNotes = getAllRegexNotes();
    const initialHash = hashNotes(initialNotes);
    setBaselineTesterNotesHash(initialHash);
    setCurrentTesterNotesHash(initialHash);
  }, []); // Only on mount

  // Update currentTesterNotesHash when notes change
  useEffect(() => {
    const notes = getAllRegexNotes();
    const newHash = hashNotes(notes);
    setCurrentTesterNotesHash(newHash);
  }, [allNotes, getAllRegexNotes]); // Re-run when notes change

  // Calculate dirty flag - compare strings exactly (spaces are significant)
  const isDirty = useMemo(() => {
    return currentText !== baselineRegex ||
           currentTesterNotesHash !== baselineTesterNotesHash;
  }, [currentText, baselineRegex, currentTesterNotesHash, baselineTesterNotesHash]);

  // Update baseline after AI generation
  const updateBaseline = useCallback((generatedRegex: string) => {
    setBaselineRegex(generatedRegex);
    setCurrentText(generatedRegex);
    setBaselineTesterNotesHash(currentTesterNotesHash); // ✅ Update baseline hash to current
  }, [currentTesterNotesHash]);

  // Update current text (from textbox)
  const updateCurrentText = useCallback((newText: string) => {
    setCurrentText(newText);
  }, []);

  return {
    baselineRegex,
    currentText,
    isDirty,
    updateBaseline,
    updateCurrentText,
  };
}
