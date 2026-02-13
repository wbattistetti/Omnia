import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import EditorPanel, { type CustomLanguage } from '@components/CodeEditor/EditorPanel';
import EditorHeader from '@responseEditor/InlineEditors/shared/EditorHeader';
import { useEditorMode } from '@responseEditor/hooks/useEditorMode';
// ✅ FASE 2.2: Consolidated useRegexState + useRegexValidation into useRegex
import { useRegex } from '@responseEditor/hooks/useRegex';
import { useTextEditorState } from '@responseEditor/hooks/useTextEditorState';
import { usePlaceholderSelection } from '@responseEditor/hooks/usePlaceholderSelection';
import { useRegexAIGeneration } from '@responseEditor/hooks/useRegexAIGeneration'; // ✅ Remains separate (distinct feature)
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import { getIsTesting } from '@responseEditor/testingState';
import { useNotesStore } from '@responseEditor/features/step-management/stores/notesStore';
import { generateBaseRegexWithNamedGroups, generateBaseRegexSimple } from '@responseEditor/utils/regexGroupUtils';
import { getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';
import type { TaskTreeNode } from '@types/taskTypes';

import { RowResult } from '@responseEditor/hooks/useExtractionTesting';

interface RegexInlineEditorProps {
  regex: string; // ✅ regex ufficiale (prop)
  setRegex: (value: string) => void; // ✅ Aggiorna solo locale (non salva)
  onClose: () => void;
  node?: any; // Optional: node with subData for AI regex generation
  kind?: string; // Optional: kind for AI regex generation
  profile?: NLPProfile; // Profile for accessing other fields
  testCases?: string[]; // ✅ Test cases passed directly from useProfileState
  setTestCases?: (cases: string[]) => void; // ✅ Setter passed directly from useProfileState
  onProfileUpdate?: (profile: NLPProfile) => void; // Callback to update profile
  onButtonRender?: (button: React.ReactNode) => void; // ✅ Callback to render button in overlay header
  onErrorRender?: (errorMessage: React.ReactNode | null) => void; // ✅ Callback to render error message in overlay header
  // ✅ NEW: Feedback from test notes
  examplesList?: string[];
  rowResults?: RowResult[];
  // ✅ REMOVED: getNote prop - now managed via Zustand store
}

/**
 * Inline editor for configuring regex patterns
 * Supports AI-powered regex generation
 */
export default function RegexInlineEditor({
  regex,
  setRegex,
  onClose,
  node,
  kind,
  profile,
  testCases: testCasesProp,
  setTestCases: setTestCasesProp,
  onProfileUpdate,
  onButtonRender,
  onErrorRender,
  examplesList = [],
  rowResults = [],
}: RegexInlineEditorProps) {
  // ✅ Use Zustand store for notes
  const getNote = useNotesStore((s) => s.getNote);

  // Debounce timer for profile updates to avoid too many calls
  const profileUpdateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Usa testCases da props se disponibili, altrimenti fallback a profile
  const testCases = testCasesProp || profile?.testCases || [];

  const setTestCases = React.useCallback((cases: string[]) => {
    // ✅ Usa setter diretto se disponibile
    if (setTestCasesProp) {
      setTestCasesProp(cases);
    } else if (onProfileUpdate && profile) {
      // Fallback: aggiorna tramite onProfileUpdate
      onProfileUpdate({ ...profile, testCases: cases });
    }
  }, [setTestCasesProp, profile, onProfileUpdate]);

  // ✅ Refs to store updateBaseline and setRegex for use in onSuccess callback
  const updateBaselineRef = React.useRef<((generatedRegex: string) => void) | null>(null);
  const setRegexRef = React.useRef<((value: string) => void) | null>(null);
  const onProfileUpdateRef = React.useRef<((profile: NLPProfile) => void) | undefined>(onProfileUpdate);
  const profileRef = React.useRef<NLPProfile | undefined>(profile);

  // ✅ Update refs when values change
  React.useEffect(() => {
    onProfileUpdateRef.current = onProfileUpdate;
    profileRef.current = profile;
  }, [onProfileUpdate, profile]);

  // ✅ FASE 2: Wrapper ref per Promise - DEVE essere PRIMA di useRegexAIGeneration
  const aiRequestPromiseRef = React.useRef<{ resolve: (value: string) => void; reject: (error: Error) => void } | null>(null);

  // ✅ AI generation hook (must be before useRegex to provide generatingRegex state)
  const {
    generatingRegex,
    regexBackup,
    generateRegex,
  } = useRegexAIGeneration({
    node,
    kind,
    testCases,
    examplesList,
    rowResults,
    // ✅ REMOVED: getNote prop - now managed via Zustand store
    onSuccess: (newRegex: string) => {
      // ✅ FASE 2: Risolvi la Promise per onAIRequest
      if (aiRequestPromiseRef.current) {
        aiRequestPromiseRef.current.resolve(newRegex);
        aiRequestPromiseRef.current = null;
      }
      // ✅ Update baseline after AI generation using refs
      if (updateBaselineRef.current) {
        updateBaselineRef.current(newRegex);
      }
      if (setRegexRef.current) {
        setRegexRef.current(newRegex);
      }
      // ✅ Save regex to profile immediately
      if (onProfileUpdateRef.current && profileRef.current) {
        const updatedProfile = {
          ...profileRef.current,
          regex: newRegex || undefined
        };
        onProfileUpdateRef.current(updatedProfile);
      }
    },
    onError: (error: Error) => {
      // ✅ FASE 2: Rifiuta la Promise per onAIRequest
      if (aiRequestPromiseRef.current) {
        aiRequestPromiseRef.current.reject(error);
        aiRequestPromiseRef.current = null;
      }
      alert(`Error generating regex: ${error.message}`);
    },
  });

  // ✅ FASE 2.2: Consolidated regex state and validation
  const {
    baselineRegex,
    currentText,
    isDirty: isDirtyFromRegex,
    updateBaseline,
    updateCurrentText,
    validationResult,
    shouldShowValidation,
    setShouldShowValidation,
  } = useRegex({
    initialRegex: regex || '',
    examplesList,
    node,
    shouldValidateOnChange: true,
    shouldValidateOnAIFinish: true,
    generatingRegex,
  });

  // ✅ FASE 2: Use unified useTextEditorState with AI integration
  const {
    localValue: localRegexValue,
    setLocalValue: setLocalRegexValue,
    isDirty: isDirtyFromState,
    buttonCaption,
    buttonEnabled,
    handleSave: handleAISave,
    commitLocalValue,
  } = useTextEditorState({
    savedValue: regex || '', // ✅ regex ufficiale (prop)
    onAIRequest: async (prompt: string) => {
      // ✅ Wrapper per generateRegex: restituisce solo la regex generata
      return new Promise<string>((resolve, reject) => {
        aiRequestPromiseRef.current = { resolve, reject };
        // ✅ generateRegex chiamerà onSuccess con la regex generata
        generateRegex(prompt, validationResult).catch(reject);
      });
    },
    createCaption: 'Create Regex',
    refineCaption: 'Refine Regex',
  });

  // ✅ FASE 2: Commit localValue to regex ufficiale when editor closes
  React.useEffect(() => {
    return () => {
      // ✅ Commit implicito alla chiusura: regex ufficiale = localValue
      commitLocalValue();
    };
  }, [commitLocalValue]);

  // ✅ Sync: useTextEditorState.localValue → useRegex.currentText (for validation)
  // This ensures validation runs when user types
  React.useEffect(() => {
    if (localRegexValue !== currentText && localRegexValue !== PLACEHOLDER_TEXT) {
      updateCurrentText(localRegexValue);
    }
  }, [localRegexValue, currentText, updateCurrentText]);

  // ✅ Combined isDirty: either from regex validation or from state
  const isDirty = isDirtyFromRegex || isDirtyFromState;

  // ✅ Update refs with actual functions from useRegex
  React.useEffect(() => {
    updateBaselineRef.current = updateBaseline;
    setRegexRef.current = setRegex;
  }, [updateBaseline, setRegex]);

  // ✅ Refs per gestire i timeout e l'editor
  const placeholderTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // Cleanup debounce timer and editor on unmount
  React.useEffect(() => {
    return () => {
      // ✅ Cleanup debounce timer
      if (profileUpdateTimeoutRef.current) {
        clearTimeout(profileUpdateTimeoutRef.current);
        profileUpdateTimeoutRef.current = null;
      }

      // ✅ Cleanup placeholder timeouts
      if (placeholderTimeoutRef.current) {
        clearTimeout(placeholderTimeoutRef.current);
        placeholderTimeoutRef.current = null;
      }

      // ✅ Cleanup requestAnimationFrame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // ✅ Cleanup debounced regex timeout
      if (debouncedRegexTimeoutRef.current) {
        clearTimeout(debouncedRegexTimeoutRef.current);
        debouncedRegexTimeoutRef.current = null;
      }

      // ✅ Cleanup error render timeout
      if (errorRenderTimeoutRef.current) {
        clearTimeout(errorRenderTimeoutRef.current);
        errorRenderTimeoutRef.current = null;
      }

      // ✅ Cleanup editor reference (EditorPanel will handle actual disposal)
      if (editorRef.current) {
        editorRef.current = null;
      }
    };
  }, []);

  // ✅ Use currentText from simple state model
  const currentRegexValue = currentText;
  const setCurrentRegexValue = (newValue: string) => {
    updateCurrentText(newValue);
  };

  // ✅ Testo guida placeholder
  const PLACEHOLDER_TEXT = "scrivi l'espressione regolare che ti serve";

  // ✅ Placeholder selection hook
  const {
    editorRef,
    hasEverWrittenRef,
    selectPlaceholderIfNeeded,
    markAsWritten,
    hasEverWritten,
  } = usePlaceholderSelection({
    placeholderText: PLACEHOLDER_TEXT,
    currentValue: currentText,
  });

  // ✅ Auto-generate base regex when editor opens and baselineRegex is empty
  React.useEffect(() => {
    // Only generate if baselineRegex is empty (not dirty)
    if (baselineRegex === '' && !isDirty && node) {
      const subNodes = getSubNodesStrict(node);

      let baseRegex = '';
      if (subNodes.length > 0) {
        // Task with subTasks: generate named groups
        baseRegex = generateBaseRegexWithNamedGroups(subNodes as TaskTreeNode[]);
      } else {
        // Task without subTasks: generate simple regex
        baseRegex = generateBaseRegexSimple(kind);
      }

      if (baseRegex && baseRegex.trim().length > 0) {
        console.log('[RegexEditor] Auto-generating placeholder regex (not saved):', baseRegex);
        updateBaseline(baseRegex);
        // ✅ Aggiorna solo localValue (placeholder), NON savedValue
        setLocalRegexValue(baseRegex);
        updateCurrentText(baseRegex);
        // ❌ NON chiamare setRegex o onProfileUpdate - la regex auto-generata è solo placeholder
      }
    }
  }, [baselineRegex, isDirty, node, kind, updateBaseline, setLocalRegexValue, updateCurrentText]); // Run when baselineRegex changes

  // ✅ Debounced value for validation (prevents flickering)
  const debouncedRegexRef = React.useRef<string>(currentText);
  const debouncedRegexTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedRegex, setDebouncedRegex] = React.useState<string>(currentText);

  // ✅ Update debounced value after user stops typing (300ms delay)
  React.useEffect(() => {
    if (debouncedRegexTimeoutRef.current) {
      clearTimeout(debouncedRegexTimeoutRef.current);
    }

    debouncedRegexTimeoutRef.current = setTimeout(() => {
      // ✅ Check testing state when timeout fires, not when effect runs
      if (getIsTesting()) {
        debouncedRegexTimeoutRef.current = null;
        return;
      }
      debouncedRegexRef.current = currentText;
      setDebouncedRegex(currentText);
      debouncedRegexTimeoutRef.current = null;
    }, 300);

    return () => {
      if (debouncedRegexTimeoutRef.current) {
        clearTimeout(debouncedRegexTimeoutRef.current);
        debouncedRegexTimeoutRef.current = null;
      }
    };
  }, [currentText]);

  // ✅ FASE 2.2: Validation now included in useRegex composito hook (above)
  // Removed separate useRegexValidation call - validation is handled by useRegex

  // ✅ Button mode: useTextEditorState provides buttonCaption and buttonEnabled
  // ✅ isCreateMode: determine from regex prop (actual saved value), NOT baselineRegex
  const isCreateMode = (regex || '').trim() === '';

  // ✅ UX CORRECTION: Check if localValue is empty or placeholder
  // ✅ Placeholder is NOT valid content - editor is considered "empty"
  const isEmptyOrPlaceholder = localRegexValue === PLACEHOLDER_TEXT || localRegexValue.trim() === '';

  // ✅ CREATE/REFINE ENABLED SE:
  //   localValue !== placeholder
  //   AND localValue.trim() !== ""
  //   AND localValue !== regex ufficiale (buttonEnabled from useTextEditorState)
  const finalButtonEnabled = !isEmptyOrPlaceholder && buttonEnabled;

  // ✅ VALIDATE ENABLED SE:
  //   localValue !== placeholder
  //   AND localValue.trim() !== ""
  //   AND not generating
  const validateButtonEnabled = !isEmptyOrPlaceholder && !generatingRegex;

  // ✅ Verifica se c'è contenuto reale (non solo placeholder)
  const hasRealContent = React.useMemo(() => {
    if (!currentText || currentText.trim() === '') return false;
    return currentText.trim() !== PLACEHOLDER_TEXT;
  }, [currentText]);

  // ✅ Verifica se ci sono test values definiti
  const hasTestValues = React.useMemo(() => {
    return testCases && testCases.length > 0;
  }, [testCases]);


  // Update currentText when regex prop changes (sync with external changes)
  React.useEffect(() => {
    // ✅ Se regex è vuoto E l'utente non ha mai scritto, usa placeholder
    // Altrimenti usa regex (anche se vuoto, per non mostrare placeholder dopo cancellazione)
    if (!regex || regex.trim() === '') {
      if (!hasEverWritten()) {
        // Prima volta: mostra placeholder
        updateCurrentText(PLACEHOLDER_TEXT);
        // ✅ Seleziona il placeholder quando viene impostato (dopo che l'editor è montato)
        requestAnimationFrame(() => {
          setTimeout(() => {
            selectPlaceholderIfNeeded();
          }, 100);
        });
      } else {
        // Dopo che ha scritto: mostra vuoto (non placeholder)
        updateCurrentText('');
      }
    } else {
      updateCurrentText(regex);
      markAsWritten(); // L'utente ha scritto qualcosa
    }
  }, [regex, selectPlaceholderIfNeeded, hasEverWritten, markAsWritten, updateCurrentText]);

  // ✅ Seleziona il placeholder quando currentText cambia e diventa il placeholder
  React.useEffect(() => {
    if (currentText === PLACEHOLDER_TEXT && !hasEverWritten()) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          selectPlaceholderIfNeeded();
        }, 150);
      });
    }
  }, [currentText, selectPlaceholderIfNeeded, hasEverWritten]);

  // ✅ Button enabled: simple model - enabled only if dirty and not generating
  const finalShouldShowButton = !generatingRegex && finalButtonEnabled;

  // Custom language configuration for regex
  const regexCustomLanguage: CustomLanguage = React.useMemo(() => ({
    id: 'regex',
    tokenizer: {
      root: [
        // Most specific patterns first (order matters!)
        [/\(\?[:=!]/, 'regex.group.special'],  // Special groups like (?:, (?=, (?!, (?:
        [/\\[dDsSwWnrtfbv0-9]/, 'regex.escape'],  // Specific escape sequences
        [/\\./, 'regex.escape'],  // Generic escape (any char after \)
        [/\{\d+(,\d*)?\}/, 'regex.quantifier'],  // Quantifiers with braces {n} or {n,m}
        [/[\*\+\?\|]/, 'regex.quantifier'],  // Single char quantifiers
        [/[\^\$]/, 'regex.anchor'],  // Anchors
        [/\[/, 'regex.charclass'],  // Char class start
        [/\]/, 'regex.charclass'],  // Char class end
        [/\(/, 'regex.group'],  // Group start
        [/\)/, 'regex.group'],  // Group end
        [/[^\\\[\]\(\)\*\+\?\|\^\$\{\}]+/, 'regex.text']  // Text (catch-all, must be last)
      ]
    },
    theme: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'regex.group', foreground: 'FFD700' },
        { token: 'regex.group.special', foreground: 'FFA500' },
        { token: 'regex.charclass', foreground: 'ADFF2F' },
        { token: 'regex.escape', foreground: 'FF69B4' },
        { token: 'regex.quantifier', foreground: '00FFFF' },
        { token: 'regex.anchor', foreground: 'FF4500' },
        { token: 'regex.text', foreground: 'FFFFFF' }
      ],
      colors: {
        'editor.background': '#1e1e1e'
      }
    },
    themeName: 'regexTheme'
  }), []);

  // Handle ESC key to cancel AI generation (if needed in future)
  // Note: Currently AI generation is immediate, so ESC cancellation is not implemented
  // If needed, can be added to useRegexAIGeneration hook

  // ✅ FASE 2: Unified button click handler - ALWAYS calls AI
  // ✅ If button is visible, it's clickable (no need to check finalButtonEnabled)
  const handleButtonClick = React.useCallback(async () => {
    console.log('[AI Regex] 🔵 ' + buttonCaption + ' clicked, starting AI generation');
    // ✅ handleAISave() always calls AI with localValue as prompt
    await handleAISave();
  }, [handleAISave, buttonCaption]);

  // ✅ FASE 5: Handle Validate Regex button click
  // ✅ Always visible, no AI, no modifications, only shows syntax errors
  const handleValidateRegex = React.useCallback(() => {
    // ✅ Force validation to show
    setShouldShowValidation(true);
    // ✅ Validation result is already available from useRegex
    // ✅ Errors are shown via onErrorRender callback
  }, [setShouldShowValidation]);

  // ✅ UX CORRECTION: Wrap onButtonRender to include Validate button
  // ✅ Validate button is always visible, positioned to the left of Create/Refine button
  const wrappedOnButtonRender = React.useCallback((mainButton: React.ReactNode) => {
    if (!onButtonRender) return;

    // ✅ Create Validate button - always visible
    const validateButton = (
      <button
        type="button"
        onClick={handleValidateRegex}
        disabled={!validateButtonEnabled}
        style={{
          padding: '6px 12px',
          background: 'transparent',
          color: validateButtonEnabled ? '#6b7280' : '#9ca3af',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          cursor: validateButtonEnabled ? 'pointer' : 'not-allowed',
          fontWeight: 500,
          fontSize: 13,
          opacity: validateButtonEnabled ? 1 : 0.5,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Validate Regex
      </button>
    );

    // ✅ Render both buttons together: [ Validate ] [ Create/Refine ]
    // ✅ Validate is always visible, Create/Refine only if shouldShowButton
    const buttonGroup = (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {validateButton}
        {mainButton}
      </div>
    );

    onButtonRender(buttonGroup);
  }, [onButtonRender, handleValidateRegex, validateButtonEnabled]);

  // ✅ Debounce timer for error message updates to prevent flickering
  const errorRenderTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Passa il messaggio di validazione (errore o successo) all'overlay header
  // ✅ DEBOUNCED per evitare flickering - aggiorna solo quando la validazione è stabile
  React.useEffect(() => {
    if (errorRenderTimeoutRef.current) {
      clearTimeout(errorRenderTimeoutRef.current);
    }

    if (!onErrorRender) return;

    // Debounce the error message update to prevent flickering
    errorRenderTimeoutRef.current = setTimeout(() => {
      // ✅ Check testing state when timeout fires
      if (getIsTesting()) {
        errorRenderTimeoutRef.current = null;
        return;
      }

      if (shouldShowValidation && validationResult) {
        if (validationResult.valid) {
          // ✅ Messaggio di successo sintetico - solo "OK"
          onErrorRender(
            <span
              style={{
                color: '#10b981',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                border: '1px solid #10b981',
                borderRadius: 4,
                background: 'transparent',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '-0.01em',
                marginLeft: '12px', // ✅ Staccato dalla parte sinistra
              }}
              title="Gruppi corretti"
            >
              <CheckCircle2 size={12} />
              <span>OK</span>
            </span>
          );
        } else {
          // ✅ Messaggio di errore sintetico - solo conteggio gruppi
          const groupsText = `${validationResult.groupsFound}/${validationResult.groupsExpected}`;
          const fullErrorText = validationResult.errors.length > 0
            ? `${groupsText} gruppi. ${validationResult.errors.join('. ')}`
            : groupsText;

          // Estrai i nomi mancanti per il tooltip
          const missingGroupsMatch = validationResult.errors.find(e => e.includes('Missing named groups'));
          const missingGroups = missingGroupsMatch
            ? missingGroupsMatch.match(/Missing named groups: ([^.]+)/)?.[1] || ''
            : '';

          onErrorRender(
            <span
              style={{
                color: '#ef4444',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                border: '1px solid #ef4444',
                borderRadius: 4,
                background: 'transparent',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '-0.01em',
                marginLeft: '12px', // ✅ Staccato dalla parte sinistra
              }}
              title={fullErrorText} // ✅ Tooltip con messaggio completo
            >
              <AlertTriangle size={12} />
              <span>{groupsText}</span>
              {missingGroups && <span style={{ marginLeft: 4, opacity: 0.8 }}>• {missingGroups}</span>}
            </span>
          );
        }
      } else {
        onErrorRender(null);
      }
    }, 100); // Small delay to batch updates

    return () => {
      if (errorRenderTimeoutRef.current) {
        clearTimeout(errorRenderTimeoutRef.current);
        errorRenderTimeoutRef.current = null;
      }
    };
  }, [shouldShowValidation, validationResult, onErrorRender]);

  return (
    <div
      style={{
        padding: 0,
        background: '#f9fafb',
        animation: 'fadeIn 0.2s ease-in',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
      }}
    >
      <EditorHeader
        title=""
        extractorType="regex"
        isCreateMode={isCreateMode}
        isGenerating={generatingRegex}
        shouldShowButton={!!finalShouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={onClose}
        hideButton={true}
        onButtonRender={wrappedOnButtonRender}
        buttonCaption={generatingRegex ? 'Sto creando l\'espressione regolare...' : buttonCaption} // ✅ Show generating state
        validationBadge={undefined} // ✅ Non mostrare più il validationBadge nell'EditorHeader, lo mostriamo nell'overlay header
        errorMessage={undefined} // ✅ Non mostrare più l'errorMessage nell'EditorHeader, lo mostriamo nell'overlay header
      />


      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
        flex: 1,
        minHeight: 0,
        maxHeight: '100%',
        height: '100%',
      }}>
        <div style={{
          flex: 1,
          position: 'relative',
          minWidth: 0,
          flexShrink: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          maxHeight: '100%',
        }}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: '100%',
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Spinner overlay durante generazione */}
            {generatingRegex && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.85)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 99999,
                  gap: 16,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    border: '4px solid #3b82f6',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <div style={{ color: '#fff', fontWeight: 500 }}>
                  Generating regex...
                </div>
              </div>
            )}
            <EditorPanel
              code={localRegexValue || (hasEverWritten() ? '' : PLACEHOLDER_TEXT)}
              renderWhitespace="all" // ✅ Show all whitespace characters (spaces, tabs)
              onChange={(v: string) => {
                if (!generatingRegex) {
                  // ✅ Rimuovi placeholder se l'utente inizia a scrivere
                  let newValue = v || '';

                  // ✅ Se l'utente sta scrivendo e il valore contiene il placeholder, rimuovilo
                  // Questo gestisce il caso in cui l'utente inizia a digitare con il placeholder selezionato
                  if (newValue.includes(PLACEHOLDER_TEXT) && newValue !== PLACEHOLDER_TEXT) {
                    // L'utente sta scrivendo sopra il placeholder (placeholder selezionato + digitazione)
                    newValue = newValue.replace(PLACEHOLDER_TEXT, '');
                    markAsWritten();
                  } else if (newValue === PLACEHOLDER_TEXT) {
                    // L'utente ha solo il placeholder - non fare nulla, mantieni placeholder
                    return;
                  } else if (newValue.trim() !== '' && newValue !== PLACEHOLDER_TEXT) {
                    // L'utente ha scritto qualcosa di reale (non placeholder)
                    // Se il valore precedente era il placeholder, significa che l'utente ha iniziato a scrivere
                    if (localRegexValue === PLACEHOLDER_TEXT) {
                      markAsWritten();
                    }
                  } else if (newValue === '' && hasEverWritten()) {
                    // L'utente ha cancellato tutto dopo aver scritto - non mostrare placeholder
                    // Flag già settato, non serve fare nulla
                  }

                  // ✅ FASE 4: Update only local state (not saved)
                  // setLocalRegexValue will sync to updateCurrentText via useEffect for validation
                  setLocalRegexValue(newValue);
                  // ✅ setRegex updates only local state (not saved) - syncs with RecognitionEditor
                  setRegex(newValue);

                  // ✅ Debounce profile update to avoid too many calls and prevent editor freezing
                  if (profileUpdateTimeoutRef.current) {
                    clearTimeout(profileUpdateTimeoutRef.current);
                  }
                  profileUpdateTimeoutRef.current = setTimeout(() => {
                    if (onProfileUpdate && profile) {
                      const updatedProfile = {
                        ...profile,
                        regex: newValue || undefined
                      };
                      onProfileUpdate(updatedProfile);
                    }
                    profileUpdateTimeoutRef.current = null;
                  }, 500); // 500ms debounce - wait for user to stop typing
                }
              }}
              language={undefined}
              customLanguage={regexCustomLanguage}
              useTemplate={false}
              fontSize={13}
              onEditorMount={(editor: any) => {
                editorRef.current = editor;

                // ✅ Se c'è il placeholder, selezionalo automaticamente
                if (currentRegexValue === PLACEHOLDER_TEXT && !hasEverWritten()) {
                  // ✅ Cleanup any existing timeouts/RAF before creating new ones
                  if (placeholderTimeoutRef.current) {
                    clearTimeout(placeholderTimeoutRef.current);
                  }
                  if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                  }

                  rafRef.current = requestAnimationFrame(() => {
                    placeholderTimeoutRef.current = setTimeout(() => {
                      if (editorRef.current && !hasEverWritten()) {
                        selectPlaceholderIfNeeded();
                        // ✅ Doppio check dopo un breve delay
                        placeholderTimeoutRef.current = setTimeout(() => {
                          if (editorRef.current && editorRef.current.getModel() && !hasEverWritten()) {
                            const model = editorRef.current.getModel();
                            const value = model.getValue();
                            if (value === PLACEHOLDER_TEXT) {
                              const selection = editorRef.current.getSelection();
                              // Se la selezione non è corretta, riapplica
                              if (!selection || selection.startColumn !== 1) {
                                selectPlaceholderIfNeeded();
                              }
                            }
                          }
                        }, 100);
                      }
                    }, 50);
                  });
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

