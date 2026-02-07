import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import EditorPanel, { type CustomLanguage } from '@components/CodeEditor/EditorPanel';
import EditorHeader from '@responseEditor/InlineEditors/shared/EditorHeader';
import { useEditorMode } from '@responseEditor/hooks/useEditorMode';
// ✅ FASE 2.2: Consolidated useRegexState + useRegexValidation into useRegex
import { useRegex } from '@responseEditor/hooks/useRegex';
import { useRegexButtonMode } from '@responseEditor/hooks/useRegexButtonMode';
import { usePlaceholderSelection } from '@responseEditor/hooks/usePlaceholderSelection';
import { useRegexAIGeneration } from '@responseEditor/hooks/useRegexAIGeneration'; // ✅ Remains separate (distinct feature)
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import { getIsTesting } from '@responseEditor/testingState';
import { useNotesStore } from '@responseEditor/features/step-management/stores/notesStore';
import { generateBaseRegexWithNamedGroups, generateBaseRegexSimple } from '@responseEditor/utils/regexGroupUtils';
import type { TaskTreeNode } from '@types/taskTypes';

import { RowResult } from '@responseEditor/hooks/useExtractionTesting';

interface RegexInlineEditorProps {
  regex: string;
  setRegex: (value: string) => void;
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

  // ✅ FASE 2.2: Consolidated regex state and validation
  const {
    baselineRegex,
    currentText,
    isDirty,
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
      // Get subNodes from node (support both subNodes and subData/subSlots for backward compatibility)
      const subNodes = (node as TaskTreeNode).subNodes || node.subData || node.subSlots || [];

      let baseRegex = '';
      if (subNodes.length > 0) {
        // Task with subTasks: generate named groups
        baseRegex = generateBaseRegexWithNamedGroups(subNodes as TaskTreeNode[]);
      } else {
        // Task without subTasks: generate simple regex
        baseRegex = generateBaseRegexSimple(kind);
      }

      if (baseRegex && baseRegex.trim().length > 0) {
        console.log('[RegexEditor] Auto-generating base regex:', baseRegex);
        updateBaseline(baseRegex);
        setRegex(baseRegex);

        // Save to profile if available
        if (onProfileUpdate && profile) {
          const updatedProfile = {
            ...profile,
            regex: baseRegex
          };
          onProfileUpdate(updatedProfile);
        }
      }
    }
  }, [baselineRegex, isDirty, node, kind, updateBaseline, setRegex, onProfileUpdate, profile]); // Run when baselineRegex changes

  // ✅ AI generation hook (must be before validation to get generatingRegex state)
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
      // ✅ Update baseline after AI generation
      updateBaseline(newRegex);
      setRegex(newRegex);
      // ✅ Save regex to profile immediately
      if (onProfileUpdate && profile) {
        const updatedProfile = {
          ...profile,
          regex: newRegex || undefined
        };
        onProfileUpdate(updatedProfile);
      }
    },
    onError: (error: Error) => {
      alert(`Error generating regex: ${error.message}`);
    },
  });

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

  // ✅ Simple button mode: one button with dynamic caption
  const {
    buttonCaption,
    buttonEnabled,
    isCreateMode,
  } = useRegexButtonMode({
    baselineRegex,
    isDirty,
    hasValidationErrors: validationResult !== null && !validationResult.valid && validationResult.errors.length > 0, // ✅ Include validation errors
  });

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
  const finalShouldShowButton = !generatingRegex && buttonEnabled;

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

  // ✅ Unified button click handler - delegates to AI generation hook
  const handleButtonClick = React.useCallback(async () => {
    if (!buttonEnabled) return; // Don't generate if not dirty
    console.log('[AI Regex] 🔵 ' + buttonCaption + ' clicked, starting generation');
    await generateRegex(currentText, validationResult);
  }, [currentText, validationResult, generateRegex, buttonCaption, buttonEnabled]);

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
        onButtonRender={onButtonRender}
        validationBadge={undefined} // ✅ Non mostrare più il validationBadge nell'EditorHeader, lo mostriamo nell'overlay header
        errorMessage={undefined} // ✅ Non mostrare più l'errorMessage nell'EditorHeader, lo mostriamo nell'overlay header
        buttonCaption={buttonCaption} // ✅ Pass custom caption
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
              code={currentText || (hasEverWritten() ? '' : PLACEHOLDER_TEXT)}
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
                    if (currentText === PLACEHOLDER_TEXT) {
                      markAsWritten();
                    }
                  } else if (newValue === '' && hasEverWritten()) {
                    // L'utente ha cancellato tutto dopo aver scritto - non mostrare placeholder
                    // Flag già settato, non serve fare nulla
                  }

                  // ✅ Update currentText (this will trigger dirty flag calculation)
                  updateCurrentText(newValue);

                  // ✅ Salva solo se non è vuoto (non salvare il placeholder)
                  if (newValue !== PLACEHOLDER_TEXT && newValue.trim() !== '') {
                    setRegex(newValue);
                  } else if (newValue === '') {
                    // Se è vuoto, salva stringa vuota (non placeholder)
                    setRegex('');
                  }

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

