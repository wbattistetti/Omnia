import React from 'react';
import EditorPanel, { type CustomLanguage } from '../../../CodeEditor/EditorPanel';
import TestValuesColumn, { type TestResult } from './shared/TestValuesColumn';
import EditorHeader from './shared/EditorHeader';
import { useTestValues } from '../hooks/useTestValues';
import { useEditorMode } from '../hooks/useEditorMode';
import { NLPProfile } from '../NLPExtractorProfileEditor';

// Helper to map label to standard key (same logic as pipeline.ts)
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

// Validate regex capture groups against expected sub-data
interface ValidationResult {
  valid: boolean;
  groupsFound: number;
  groupsExpected: number;
  errors: string[];
  warnings: string[];
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

interface RegexInlineEditorProps {
  regex: string;
  setRegex: (value: string) => void;
  onClose: () => void;
  node?: any; // Optional: node with subData for AI regex generation
  kind?: string; // Optional: kind for AI regex generation
  profile?: NLPProfile; // Profile for accessing testCases
  onProfileUpdate?: (profile: NLPProfile) => void; // Callback to update profile
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
  onProfileUpdate,
}: RegexInlineEditorProps) {
  const [regexAiMode, setRegexAiMode] = React.useState(false);
  const [regexAiPrompt, setRegexAiPrompt] = React.useState('');
  const [regexBackup, setRegexBackup] = React.useState('');
  const [generatingRegex, setGeneratingRegex] = React.useState(false);
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [shouldShowValidation, setShouldShowValidation] = React.useState(false);

  // Debounce timer for profile updates to avoid too many calls
  const profileUpdateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // 🔍 LOG: Verifica profile ricevuto come prop
  React.useEffect(() => {
    console.log('[RegexInlineEditor] 📥 Profile prop received:', {
      nodeLabel: node?.label,
      hasProfile: !!profile,
      profileKeys: profile ? Object.keys(profile) : [],
      testCasesInProfile: profile ? (Array.isArray(profile.testCases) ? profile.testCases.length : 'not array or missing') : 'no profile',
      testCasesValue: profile?.testCases,
      profileTestCasesType: profile ? typeof profile.testCases : 'no profile',
    });
  }, [profile, node?.label]);

  // 🆕 Use shared hook for test cases
  const { testCases, setTestCases } = useTestValues(
    profile || { slotId: '', locale: 'it-IT', kind: kind || 'generic', synonyms: [] },
    onProfileUpdate || (() => { })
  );

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (profileUpdateTimeoutRef.current) {
        clearTimeout(profileUpdateTimeoutRef.current);
        profileUpdateTimeoutRef.current = null;
      }
    };
  }, []);

  // Debug: Log test cases to verify they're being passed
  React.useEffect(() => {
    console.log('[RegexInlineEditor] 🔍 Test cases hook result:', {
      testCasesCount: testCases?.length || 0,
      testCasesValue: testCases,
      hasProfile: !!profile,
      profileTestCases: profile?.testCases,
    });

    if (testCases && testCases.length > 0) {
      console.log('[RegexInlineEditor] ✅ Test cases loaded:', testCases.length, 'cases');
      console.log('[RegexInlineEditor] ✅ Test cases values:', testCases);
    } else if (profile?.testCases && profile.testCases.length > 0) {
      console.log('[RegexInlineEditor] ⚠️ Profile has testCases but hook returned empty:', profile.testCases);
    } else {
      console.log('[RegexInlineEditor] ℹ️ No test cases available yet');
    }
  }, [testCases, profile?.testCases]);

  // Use unified editor mode hook
  const { currentValue: currentRegexValue, setCurrentValue: setCurrentRegexValue, isCreateMode, getButtonLabel } = useEditorMode({
    initialValue: regex,
    templateValue: '',
    hasUserEdited,
    extractorType: 'regex',
  });

  // 🆕 Override button label logic: "Create Regex" only if regex is empty, otherwise "Refine Regex"
  const isRegexEmpty = !currentRegexValue || currentRegexValue.trim().length === 0;
  const overrideIsCreateMode = isRegexEmpty;

  // 🆕 Validate regex ONLY when AI finishes generating (not on every textbox change)
  const prevGeneratingRegex = React.useRef(generatingRegex);
  React.useEffect(() => {
    // If generatingRegex just changed from true to false, validate and show
    if (prevGeneratingRegex.current && !generatingRegex && currentRegexValue && currentRegexValue.trim().length > 0) {
      const validation = validateRegexGroups(currentRegexValue, node);
      setValidationResult(validation);
      setShouldShowValidation(true);
      console.log('[AI Regex] ✅ AI finished, validation result:', validation);
    }
    prevGeneratingRegex.current = generatingRegex;
  }, [generatingRegex, currentRegexValue, node]);

  // Update current value when regex prop changes
  React.useEffect(() => {
    setCurrentRegexValue(regex);
  }, [regex]);

  // Show button if:
  // - NOT generating
  // - AND (regex is empty OR user has edited OR there are validation errors to fix)
  const shouldShowButton = !generatingRegex && (isRegexEmpty || hasUserEdited || (shouldShowValidation && validationResult && !validationResult.valid));

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

  // Handle ESC key to exit AI mode
  React.useEffect(() => {
    if (!regexAiMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && regexAiMode) {
        setRegexAiMode(false);
        if (regexBackup) {
          setRegex(regexBackup);
          setCurrentRegexValue(regexBackup);
        }
        e.preventDefault();
        console.log('[AI Regex] Cancelled via ESC - restored:', regexBackup);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [regexAiMode, regexBackup]);

  // Unified button click handler - starts AI generation immediately
  const handleButtonClick = async () => {
    let prompt = currentRegexValue || '';

    // 🆕 Find test cases that don't match the current regex
    const unmatchedTestCases: string[] = [];
    if (currentRegexValue && currentRegexValue.trim() && testCases.length > 0) {
      try {
        const regexObj = new RegExp(currentRegexValue, 'g');
        testCases.forEach((testCase) => {
          const match = testCase.match(regexObj);
          if (!match) {
            unmatchedTestCases.push(testCase);
          }
        });
      } catch (e) {
        // Invalid regex - will be handled by validation errors
      }
    }

    // If regex is invalid, include validation errors in the prompt
    if (validationResult && !validationResult.valid && validationResult.errors.length > 0) {
      const errorsText = validationResult.errors.join('. ');
      const warningsText = validationResult.warnings.length > 0 ? ' Warnings: ' + validationResult.warnings.join('. ') : '';
      prompt = `Current regex: ${currentRegexValue}\n\nErrors found: ${errorsText}${warningsText}\n\nPlease fix the regex to include the correct capture groups. Expected ${validationResult.groupsExpected} capture groups for: ${(() => {
        const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
        return allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ');
      })()}`;

      // 🆕 Add unmatched test cases to the prompt
      if (unmatchedTestCases.length > 0) {
        prompt += `\n\nIMPORTANT: The following test values should be matched by the regex but are currently NOT matching:\n${unmatchedTestCases.map(tc => `- "${tc}"`).join('\n')}\n\nPlease fix the regex so it matches all these values.`;
      }

      console.log('[AI Regex] 🔵 Refine Regex clicked with validation errors, enhancing prompt');
      if (unmatchedTestCases.length > 0) {
        console.log('[AI Regex] 🔵 Including unmatched test cases in prompt:', unmatchedTestCases);
      }
    } else if (unmatchedTestCases.length > 0) {
      // 🆕 If regex is valid but has unmatched test cases, enhance the prompt
      const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
      const subLabels = allSubs.length > 0
        ? allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ')
        : 'the sub-data components';

      prompt = `Current regex: ${currentRegexValue}\n\nThe following test values should be matched by the regex but are currently NOT matching:\n${unmatchedTestCases.map(tc => `- "${tc}"`).join('\n')}\n\nPlease refine the regex so it matches all these values while maintaining the existing capture groups for: ${subLabels}`;
      console.log('[AI Regex] 🔵 Refine Regex clicked with unmatched test cases:', unmatchedTestCases);
    }

    if (!prompt.trim() || prompt.trim().length < 5) {
      console.log('[AI Regex] ❌ Prompt too short, cannot generate');
      return;
    }

    console.log('[AI Regex] 🔵 ' + getButtonLabel() + ' clicked, starting generation immediately');
    console.log('[AI Regex] 🔵 Using prompt:', prompt);
    console.log('[AI Regex] 🔵 Unmatched test cases count:', unmatchedTestCases.length);

    // Save backup
    setRegexBackup(currentRegexValue);

    // Start generation immediately (no AI mode)
    setGeneratingRegex(true);

    try {
      // Extract sub-data from node if available
      const subData = (node?.subData || node?.subSlots || []) as any[];
      const subDataInfo = subData.map((sub: any, index: number) => ({
        id: sub.id || `sub-${index}`,
        label: sub.label || sub.name || '',
        index: index + 1 // Position in capture groups (1, 2, 3...)
      }));

      // Get AI provider and model from localStorage
      let provider = 'groq';
      let model: string | undefined = undefined;
      try {
        const savedProvider = localStorage.getItem('omnia.aiProvider') || 'groq';
        const savedModel = localStorage.getItem('omnia.aiModel');
        provider = savedProvider;
        model = savedModel || undefined;
      } catch (e) {
        console.warn('[AI Regex] Could not read AI config from localStorage:', e);
      }

      const requestBody = {
        description: prompt,
        subData: subDataInfo.length > 0 ? subDataInfo : undefined,
        kind: kind || undefined,
        provider,
        model
      };

      console.log('[AI Regex] 🟢 Calling API /api/nlp/generate-regex');
      console.log('[AI Regex] 🟢 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('/api/nlp/generate-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[AI Regex] 🟢 API Response status:', response.status);
      console.log('[AI Regex] 🟢 API Response ok:', response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.log('[AI Regex] ❌ API Error response:', error);
        throw new Error(error.detail || 'Failed to generate regex');
      }

      const data = await response.json();
      console.log('[AI Regex] ✅ API Response data:', data);
      console.log('[AI Regex] ✅ data.success:', data.success);
      console.log('[AI Regex] ✅ data.regex:', data.regex);

      if (data.success && data.regex) {
        const newRegex = data.regex.trim();

        console.log('[AI Regex] ✅ Regex generated successfully:', newRegex);
        console.log('[AI Regex] ✅ Updating state variables...');

        // Update state variables immediately
        setRegex(newRegex);
        console.log('[AI Regex] ✅ Called setRegex with:', newRegex);

        setCurrentRegexValue(newRegex);
        console.log('[AI Regex] ✅ Called setCurrentRegexValue with:', newRegex);

        // ✅ Save regex to profile immediately (no timing issues)
        if (onProfileUpdate && profile) {
          const updatedProfile = {
            ...profile,
            regex: newRegex || undefined
          };
          console.log('[AI Regex] ✅ Saving regex to profile immediately');
          onProfileUpdate(updatedProfile);
        }

        // Reset hasUserEdited since we now have a new generated regex
        setHasUserEdited(false);

        // ⚠️ Test cases are now generated at profile initialization, not here
        // Keep examples for potential future use, but don't overwrite existing testCases

        if (data.explanation) {
          console.log('[AI Regex] ✅ Explanation:', data.explanation);
        }
      } else {
        console.log('[AI Regex] ❌ Invalid response: data.success =', data.success, ', data.regex =', data.regex);
        throw new Error('No regex returned from API');
      }
    } catch (error) {
      console.error('[AI Regex] ❌ Error caught:', error);
      console.error('[AI Regex] ❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      alert(
        `Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      console.log('[AI Regex] 🟢 Finally block: setting generatingRegex to false');
      setGeneratingRegex(false);
      console.log('[AI Regex] 🟢 generatingRegex should now be: false');
    }
  };


  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb',
        animation: 'fadeIn 0.2s ease-in',
      }}
    >
      <EditorHeader
        title="🪄 Edit Regex"
        extractorType="regex"
        isCreateMode={overrideIsCreateMode}
        isGenerating={generatingRegex}
        shouldShowButton={!!shouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={onClose}
        validationBadge={
          shouldShowValidation && validationResult && currentRegexValue && currentRegexValue.trim().length > 0 ? (
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
        gap: 8,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        <div
          style={{
            display: 'flex',
            gap: 0,
            alignItems: 'flex-start',
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{
            flex: 3,
            position: 'relative',
            minWidth: 0,
            flexShrink: 1,
            overflow: 'hidden'
          }}>
            <div
              style={{
                height: 500,
                border: regexAiMode ? '2px solid #3b82f6' : '1px solid #334155',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Spinner overlay durante generazione */}
              {(() => {
                console.log('[AI Regex] 🎨 Rendering spinner check - generatingRegex:', generatingRegex);
                return generatingRegex;
              })() && (
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
                code={(() => {
                  const codeValue = regexAiMode
                    ? regexAiPrompt
                    : currentRegexValue;
                  console.log('[AI Regex] 🎨 EditorPanel code value:', {
                    regexAiMode,
                    regexAiPrompt,
                    currentRegexValue,
                    finalValue: codeValue,
                    codeLength: codeValue?.length || 0
                  });
                  return codeValue;
                })()}
                onChange={(v: string) => {
                  if (regexAiMode && !generatingRegex) {
                    setRegexAiPrompt(v || '');
                  } else if (!generatingRegex) {
                    const newValue = v || '';
                    setCurrentRegexValue(newValue);
                    setRegex(newValue);
                    // Mark as edited if different from original value
                    if (newValue !== regex) {
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
                language={regexAiMode ? 'plaintext' : undefined}
                customLanguage={regexAiMode ? undefined : regexCustomLanguage}
                useTemplate={false}
                fontSize={13}
              />
            </div>
          </div>

          {/* 🆕 Right: Test Cases Column - Using shared component */}
          <TestValuesColumn
            testCases={testCases}
            onTestCasesChange={setTestCases}
            testFunction={(value: string): TestResult => {
              if (!currentRegexValue || !currentRegexValue.trim()) {
                return { matched: false, error: 'Regex vuoto' };
              }

              try {
                const regexObj = new RegExp(currentRegexValue, 'g');
                const match = value.match(regexObj);
                if (match) {
                  const groups = match.slice(1).filter((g) => g !== undefined && g !== null);
                  const extracted: Record<string, string> = {};

                  // Map groups to sub-data if available
                  if (node && (node.subData || node.subSlots) && groups.length > 0) {
                    const allSubs = [...(node.subData || []), ...(node.subSlots || [])];
                    groups.forEach((group, i) => {
                      if (i < allSubs.length) {
                        const sub = allSubs[i];
                        const label = String(sub?.label || sub?.name || `group${i + 1}`).toLowerCase();
                        extracted[label] = group;
                      }
                    });
                  }

                  return {
                    matched: true,
                    fullMatch: match[0],
                    groups,
                    extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
                  };
                }
                return { matched: false };
              } catch (e) {
                return { matched: false, error: 'Regex non valido' };
              }
            }}
            extractorType="regex"
            node={node}
            enabled={true}
          />
        </div>
      </div>
    </div>
  );
}

