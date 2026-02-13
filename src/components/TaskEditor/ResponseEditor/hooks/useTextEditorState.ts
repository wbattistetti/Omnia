// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useEffect, useCallback } from 'react';

export interface UseTextEditorStateParams {
  savedValue: string; // ✅ regex ufficiale (prop)
  onAIRequest?: (prompt: string) => Promise<string>; // ✅ Nuovo: callback per AI
  createCaption?: string;
  refineCaption?: string;
}

export interface UseTextEditorStateReturn {
  localValue: string; // ✅ Contenuto textbox (quello che l'utente sta scrivendo)
  setLocalValue: (value: string) => void;
  isDirty: boolean; // ✅ localValue !== regex ufficiale
  buttonCaption: string; // ✅ Create/Refine basato su regex ufficiale
  buttonEnabled: boolean; // ✅ true solo se isDirty
  handleSave: () => Promise<void>; // ✅ Chiama AI e aggiorna localValue/savedValue
  commitLocalValue: () => void; // ✅ Nuovo: commit alla chiusura editor
}

/**
 * Unified hook for all text editors (Regex, LLM, NER, Extractor, etc.)
 *
 * AI-first editor model:
 * - localValue: current value in editor (updated immediately on typing)
 * - savedValue (regex ufficiale): official value (updated only by AI or commit on close)
 * - Writing in textbox does NOT change regex ufficiale
 * - Button "Create/Refine" always calls AI
 * - Commit on editor close: regex ufficiale = localValue
 *
 * Usage:
 * ```tsx
 * const { localValue, setLocalValue, isDirty, buttonCaption, buttonEnabled, handleSave, commitLocalValue } = useTextEditorState({
 *   savedValue: regex, // regex ufficiale
 *   onAIRequest: async (prompt) => generateRegex(prompt),
 *   createCaption: 'Create Regex',
 *   refineCaption: 'Refine Regex',
 * });
 * ```
 */
export function useTextEditorState({
  savedValue, // ✅ regex ufficiale (prop)
  onAIRequest, // ✅ Callback per AI
  createCaption = 'Create',
  refineCaption = 'Refine',
}: UseTextEditorStateParams): UseTextEditorStateReturn {
  // ✅ regex ufficiale (stato interno, inizializzato da savedValue prop)
  const [officialValue, setOfficialValue] = useState(savedValue);
  const [localValue, setLocalValue] = useState(savedValue);

  // ✅ Sync quando savedValue prop cambia esternamente
  useEffect(() => {
    setOfficialValue(savedValue);
    setLocalValue(savedValue);
  }, [savedValue]);

  // ✅ Calculate if there are unsaved changes (localValue !== regex ufficiale)
  const isDirty = localValue !== officialValue;

  // ✅ Determine button caption based on whether regex ufficiale exists
  const buttonCaption = officialValue.trim() === '' ? createCaption : refineCaption;

  // ✅ Button is enabled only if there are unsaved changes
  const buttonEnabled = isDirty;

  // ✅ Handle save: ALWAYS calls AI, updates localValue and regex ufficiale
  const handleSave = useCallback(async () => {
    if (!isDirty) return; // No changes, nothing to do
    if (!onAIRequest) {
      console.warn('[useTextEditorState] handleSave called but onAIRequest is not provided');
      return;
    }

    try {
      // ✅ Always interpret localValue as prompt for AI
      const generatedValue = await onAIRequest(localValue);

      // ✅ Update both localValue and regex ufficiale with AI result
      setLocalValue(generatedValue);
      setOfficialValue(generatedValue);
      // ✅ isDirty will be false now (localValue === officialValue)
    } catch (error) {
      console.error('[useTextEditorState] AI request failed:', error);
      // Don't update values on error
    }
  }, [isDirty, localValue, onAIRequest]);

  // ✅ Commit localValue to regex ufficiale (called when editor closes)
  const commitLocalValue = useCallback(() => {
    setOfficialValue(localValue);
    // ✅ isDirty will be false now (localValue === officialValue)
  }, [localValue]);

  return {
    localValue,
    setLocalValue,
    isDirty,
    buttonCaption,
    buttonEnabled,
    handleSave,
    commitLocalValue,
  };
}
