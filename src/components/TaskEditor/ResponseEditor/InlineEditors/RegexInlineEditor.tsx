import React from 'react';
import EditorPanel, { type CustomLanguage } from '../../../CodeEditor/EditorPanel';
import EditorHeader from './shared/EditorHeader';
import { useEditorMode } from '../hooks/useEditorMode';
import { useRegexValidation } from '../hooks/useRegexValidation';
import { useRegexButtonMode } from '../hooks/useRegexButtonMode';
import { usePlaceholderSelection } from '../hooks/usePlaceholderSelection';
import { useRegexAIGeneration } from '../hooks/useRegexAIGeneration';
import { NLPProfile } from '../NLPExtractorProfileEditor';

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
}: RegexInlineEditorProps) {
  const [hasUserEdited, setHasUserEdited] = React.useState(false);

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

      // ✅ Cleanup editor reference (EditorPanel will handle actual disposal)
      if (editorRef.current) {
        editorRef.current = null;
      }
    };
  }, []);

  // Use unified editor mode hook
  const { currentValue: currentRegexValue, setCurrentValue: setCurrentRegexValue, getButtonLabel } = useEditorMode({
    initialValue: regex,
    templateValue: '',
    hasUserEdited,
    extractorType: 'regex',
  });

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
    currentValue: currentRegexValue,
  });

  // ✅ AI generation hook (must be before validation to get generatingRegex state)
  const {
    generatingRegex,
    regexBackup,
    generateRegex,
  } = useRegexAIGeneration({
    node,
    kind,
    testCases,
    onSuccess: (newRegex: string) => {
      setRegex(newRegex);
      setCurrentRegexValue(newRegex);
      // ✅ Save regex to profile immediately
      if (onProfileUpdate && profile) {
        const updatedProfile = {
          ...profile,
          regex: newRegex || undefined
        };
        onProfileUpdate(updatedProfile);
      }
      // Reset hasUserEdited since we now have a new generated regex
      setHasUserEdited(false);
    },
    onError: (error: Error) => {
      alert(`Error generating regex: ${error.message}`);
    },
  });

  // ✅ Regex validation hook (validates on manual changes AND when AI finishes)
  const {
    validationResult,
    shouldShowValidation,
    setShouldShowValidation,
  } = useRegexValidation({
    regex: currentRegexValue,
    node,
    shouldValidateOnChange: true, // ✅ NEW: Validate also on manual changes
    shouldValidateOnAIFinish: true,
    generatingRegex, // ✅ Now correctly passed from useRegexAIGeneration
  });

  // ✅ Button mode hook (determines Create vs Refine based on regex state and validation errors)
  const {
    isCreateMode,
    shouldShowButton,
    isRegexEmpty,
    hasValidationErrors,
  } = useRegexButtonMode({
    regex: currentRegexValue,
    hasUserEdited,
    validationResult,
    placeholderText: PLACEHOLDER_TEXT,
  });

  // ✅ Verifica se c'è contenuto reale (non solo placeholder)
  const hasRealContent = React.useMemo(() => {
    if (!currentRegexValue || currentRegexValue.trim() === '') return false;
    return currentRegexValue.trim() !== PLACEHOLDER_TEXT;
  }, [currentRegexValue]);

  // ✅ Verifica se ci sono test values definiti
  const hasTestValues = React.useMemo(() => {
    return testCases && testCases.length > 0;
  }, [testCases]);


  // Update current value when regex prop changes
  React.useEffect(() => {
    // ✅ Se regex è vuoto E l'utente non ha mai scritto, usa placeholder
    // Altrimenti usa regex (anche se vuoto, per non mostrare placeholder dopo cancellazione)
    if (!regex || regex.trim() === '') {
      if (!hasEverWritten()) {
        // Prima volta: mostra placeholder
        setCurrentRegexValue(PLACEHOLDER_TEXT);
        // ✅ Seleziona il placeholder quando viene impostato (dopo che l'editor è montato)
        requestAnimationFrame(() => {
          setTimeout(() => {
            selectPlaceholderIfNeeded();
          }, 100);
        });
      } else {
        // Dopo che ha scritto: mostra vuoto (non placeholder)
        setCurrentRegexValue('');
      }
    } else {
      setCurrentRegexValue(regex);
      markAsWritten(); // L'utente ha scritto qualcosa
    }
  }, [regex, selectPlaceholderIfNeeded, hasEverWritten, markAsWritten]);

  // ✅ Seleziona il placeholder quando currentRegexValue cambia e diventa il placeholder
  React.useEffect(() => {
    if (currentRegexValue === PLACEHOLDER_TEXT && !hasEverWritten()) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          selectPlaceholderIfNeeded();
        }, 150);
      });
    }
  }, [currentRegexValue, selectPlaceholderIfNeeded, hasEverWritten]);

  // ✅ Final shouldShowButton: consider generating state and content
  const finalShouldShowButton = !generatingRegex && shouldShowButton && (hasRealContent || hasTestValues || isRegexEmpty);

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
    console.log('[AI Regex] 🔵 ' + getButtonLabel() + ' clicked, starting generation');
    await generateRegex(currentRegexValue, validationResult);
  }, [currentRegexValue, validationResult, generateRegex, getButtonLabel]);


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
        validationBadge={
          (hasRealContent || hasTestValues) && shouldShowValidation && validationResult ? (
            <div
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: validationResult.valid ? '#10b981' : '#ef4444',
                color: '#fff',
                border: '1px solid',
                borderColor: validationResult.valid ? '#059669' : '#dc2626',
                flexShrink: 0,
              }}
            >
              {validationResult.valid ? (
                <>
                  <span>✓</span>
                  <span>Gruppi corretti</span>
                </>
              ) : (
                <>
                  <span>⚠</span>
                  <span>
                    {validationResult.groupsFound}/{validationResult.groupsExpected} gruppi
                  </span>
                </>
              )}
            </div>
          ) : undefined
        }
        errorMessage={
          shouldShowValidation && validationResult && !validationResult.valid && validationResult.errors.length > 0
            ? validationResult.errors.join('. ')
            : undefined
        }
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
              code={currentRegexValue || (hasEverWritten() ? '' : PLACEHOLDER_TEXT)}
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
                    if (currentRegexValue === PLACEHOLDER_TEXT) {
                      markAsWritten();
                    }
                  } else if (newValue === '' && hasEverWritten()) {
                    // L'utente ha cancellato tutto dopo aver scritto - non mostrare placeholder
                    // Flag già settato, non serve fare nulla
                  }

                  setCurrentRegexValue(newValue);

                  // ✅ Salva solo se non è vuoto (non salvare il placeholder)
                  if (newValue !== PLACEHOLDER_TEXT && newValue.trim() !== '') {
                    setRegex(newValue);
                  } else if (newValue === '') {
                    // Se è vuoto, salva stringa vuota (non placeholder)
                    setRegex('');
                  }

                  // Mark as edited if different from original value (e non è placeholder/vuoto)
                  if (newValue !== regex && newValue !== PLACEHOLDER_TEXT && newValue.trim() !== '') {
                    setHasUserEdited(true);
                  } else if (newValue === '' && regex && regex.trim() !== '') {
                    // Se l'utente ha cancellato tutto, considera come modifica
                    setHasUserEdited(true);
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

