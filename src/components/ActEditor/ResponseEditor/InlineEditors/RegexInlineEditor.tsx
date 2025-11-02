import React from 'react';
import EditorPanel, { type CustomLanguage } from '../../../CodeEditor/EditorPanel';
import { useResizablePanel } from '../../../../hooks/useResizablePanel';

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
}: RegexInlineEditorProps) {
  const [regexAiMode, setRegexAiMode] = React.useState(false);
  const [regexAiPrompt, setRegexAiPrompt] = React.useState('');
  const [regexBackup, setRegexBackup] = React.useState('');
  const [generatingRegex, setGeneratingRegex] = React.useState(false);
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [shouldShowValidation, setShouldShowValidation] = React.useState(false);

  // 🆕 Test cases state: values to test the regex against
  const [testCases, setTestCases] = React.useState<string[]>([]);
  const [newTestCase, setNewTestCase] = React.useState('');

  // 🆕 Resizable panel for test cases column
  const { size: testColumnWidth, handleResize, style: testColumnStyle } = useResizablePanel({
    initialSize: 550,
    min: 300,
    max: 800,
    direction: 'horizontal',
    persistKey: 'regex-editor-test-column-width'
  });

  // Keep track of dragging state for resize handle
  const [isResizing, setIsResizing] = React.useState(false);

  // Track if regex was initially empty
  const wasInitiallyEmpty = React.useRef(!regex || regex.trim().length === 0);
  const [currentRegexValue, setCurrentRegexValue] = React.useState(regex);

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

  // Determine button label and visibility
  const hasContent = currentRegexValue && currentRegexValue.trim().length > 0;

  // Determine button label based on state
  const getButtonLabel = () => {
    if (generatingRegex) return 'Creating...';
    // Show "Create Regex" if empty, "Refine Regex" if has content
    return !hasContent ? 'Create Regex' : 'Refine Regex';
  };

  // Show button if:
  // - NOT generating
  // - AND (user has edited OR there are validation errors to fix)
  const shouldShowButton = !generatingRegex && (hasUserEdited || (shouldShowValidation && validationResult && !validationResult.valid));

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
        setRegex(regexBackup);
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

      const requestBody = {
        description: prompt,
        subData: subDataInfo.length > 0 ? subDataInfo : undefined,
        kind: kind || undefined
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

        // Update initial state: if regex was generated, it's no longer "initially empty"
        wasInitiallyEmpty.current = false;
        // Reset hasUserEdited since we now have a new generated regex
        setHasUserEdited(false);

        // 🆕 Save test cases from AI response
        console.log('[AI Regex] 🔍 Checking examples from AI response:', {
          hasExamples: !!data.examples,
          examplesType: typeof data.examples,
          isArray: Array.isArray(data.examples),
          examplesValue: data.examples,
          examplesLength: Array.isArray(data.examples) ? data.examples.length : 'N/A'
        });

        if (data.examples && Array.isArray(data.examples) && data.examples.length > 0) {
          const aiTestCases = data.examples.filter((ex: any) => typeof ex === 'string' && ex.trim().length > 0);
          console.log('[AI Regex] 🔍 Filtered test cases:', aiTestCases);
          if (aiTestCases.length > 0) {
            setTestCases(aiTestCases);
            console.log('[AI Regex] ✅ Saved test cases from AI:', aiTestCases);
          } else {
            console.log('[AI Regex] ⚠️ No valid string examples found. Original:', data.examples);
          }
        } else {
          console.log('[AI Regex] ⚠️ Examples not found or invalid format:', data.examples);
        }

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          🪄 Edit Regex
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Validation badge - only shown when shouldShowValidation is true */}
          {shouldShowValidation && validationResult && currentRegexValue && currentRegexValue.trim().length > 0 && (
            <>
              <div
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  fontSize: 12,
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
              {/* 🆕 Error label - shown after badge, before Refine Regex button */}
              {/* Uses flex: 1 to take available space, allows multi-line, no truncation unless truly necessary */}
              {!validationResult.valid && validationResult.errors.length > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: '#ef4444',
                    fontStyle: 'italic',
                    flex: 1,
                    minWidth: 0, // Allow flex item to shrink below content size if needed
                    whiteSpace: 'normal', // Allow multi-line wrapping
                    wordBreak: 'break-word', // Break long words if necessary
                    lineHeight: 1.4, // Better readability for multi-line
                    maxWidth: '100%', // Don't exceed container width
                  }}
                >
                  {validationResult.errors.join('. ')}
                </span>
              )}
            </>
          )}

          {/* Unified Create/Refine Regex button */}
          {shouldShowButton && (
            <button
              type="button"
              onClick={handleButtonClick}
              disabled={generatingRegex || !currentRegexValue || currentRegexValue.trim().length < 5}
              title={getButtonLabel()}
              style={{
                padding: '6px 16px',
                border: '2px solid #3b82f6',
                borderRadius: 8,
                background: (generatingRegex || !currentRegexValue || currentRegexValue.trim().length < 5) ? '#f3f4f6' : '#3b82f6',
                color: '#fff',
                cursor: (generatingRegex || !currentRegexValue || currentRegexValue.trim().length < 5) ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {generatingRegex ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      border: '2px solid #fff',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      marginRight: 6,
                    }}
                  />
                  <span>Creating...</span>
                </>
              ) : (
                getButtonLabel()
              )}
            </button>
          )}

          <button
            onClick={() => {
              // 🆕 If there are validation errors and not shown yet, validate and show before closing
              if (currentRegexValue && currentRegexValue.trim().length > 0 && !shouldShowValidation) {
                const validation = validateRegexGroups(currentRegexValue, node);
                if (!validation.valid) {
                  setValidationResult(validation);
                  setShouldShowValidation(true);
                  console.log('[AI Regex] ⚠️ Close clicked with errors, showing validation');
                  // Still allow closing (Close anyway behavior)
                }
              }
              onClose();
            }}
            style={{
              background: '#e5e7eb',
              border: 'none',
              borderRadius: 4,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ❌ Close
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            gap: 0,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
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
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
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
                  }
                }}
                language={regexAiMode ? 'plaintext' : undefined}
                customLanguage={regexAiMode ? undefined : regexCustomLanguage}
                useTemplate={false}
                fontSize={13}
              />
            </div>
          </div>

          {/* 🆕 Resize Handle - visible and interactive */}
          {currentRegexValue && currentRegexValue.trim().length > 0 && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsResizing(true);
                const startX = e.clientX;
                const startWidth = testColumnWidth;

                const onMouseMove = (ev: MouseEvent) => {
                  ev.preventDefault();
                  const delta = ev.clientX - startX;
                  const newWidth = Math.max(300, Math.min(800, startWidth - delta));
                  handleResize(newWidth);
                };

                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  document.body.style.cursor = '';
                  document.body.style.userSelect = '';
                  setIsResizing(false);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
              style={{
                width: 8,
                minWidth: 8,
                cursor: 'col-resize',
                background: isResizing
                  ? 'rgba(59, 130, 246, 0.6)'
                  : 'rgba(148, 163, 184, 0.2)',
                borderLeft: '1px solid rgba(148, 163, 184, 0.3)',
                borderRight: '1px solid rgba(148, 163, 184, 0.3)',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
                transition: isResizing ? 'none' : 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                if (!isResizing) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.4)';
                  e.currentTarget.style.borderLeft = '1px solid rgba(59, 130, 246, 0.6)';
                  e.currentTarget.style.borderRight = '1px solid rgba(59, 130, 246, 0.6)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isResizing) {
                  e.currentTarget.style.background = 'rgba(148, 163, 184, 0.2)';
                  e.currentTarget.style.borderLeft = '1px solid rgba(148, 163, 184, 0.3)';
                  e.currentTarget.style.borderRight = '1px solid rgba(148, 163, 184, 0.3)';
                }
              }}
              title="Trascina per ridimensionare il pannello"
            >
              {/* Visual indicator dots */}
              <div
                style={{
                  width: 2,
                  height: 20,
                  background: isResizing ? '#3b82f6' : 'rgba(148, 163, 184, 0.5)',
                  borderRadius: 1,
                }}
              />
            </div>
          )}

          {/* 🆕 Right: Test Cases Column */}
          {currentRegexValue && currentRegexValue.trim().length > 0 && (
            <div
              style={{
                ...testColumnStyle,
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxHeight: 500,
                overflowY: 'auto',
                background: '#1e1e1e',
                flexShrink: 0,
                minWidth: 300,
                maxWidth: 800,
              }}
            >
              {/* Recognized Values Section - includes input for adding test cases */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 }}>
                  Test Values
                </div>
                {/* Input for adding new test cases */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <input
                    type="text"
                    value={newTestCase}
                    onChange={(e) => setNewTestCase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTestCase.trim()) {
                        setTestCases((prev) => [...prev, newTestCase.trim()]);
                        setNewTestCase('');
                      }
                    }}
                    placeholder="Aggiungi frase..."
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      background: '#0f172a',
                      color: '#f1f5f9',
                      fontSize: 12,
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newTestCase.trim()) {
                        setTestCases((prev) => [...prev, newTestCase.trim()]);
                        setNewTestCase('');
                      }
                    }}
                    disabled={!newTestCase.trim()}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #334155',
                      borderRadius: 4,
                      background: newTestCase.trim() ? '#3b82f6' : '#334155',
                      color: '#fff',
                      cursor: newTestCase.trim() ? 'pointer' : 'not-allowed',
                      fontSize: 11,
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Recognized Values - two column layout (also shows test values with × button) */}
                {testCases.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {testCases.map((testCase, idx) => {
                      // Test regex against this test case
                      let matchResult: {
                        matched: boolean;
                        fullMatch?: string;
                        groups?: string[];
                        extracted?: Record<string, string>;
                      } = { matched: false };

                      if (currentRegexValue && currentRegexValue.trim()) {
                        try {
                          const regexObj = new RegExp(currentRegexValue, 'g');
                          const match = testCase.match(regexObj);
                          if (match) {
                            matchResult = {
                              matched: true,
                              fullMatch: match[0],
                              groups: match.slice(1).filter((g) => g !== undefined && g !== null),
                            };

                            // Map groups to sub-data if available
                            if (node && (node.subData || node.subSlots) && matchResult.groups && matchResult.groups.length > 0) {
                              const allSubs = [...(node.subData || []), ...(node.subSlots || [])];
                              const extracted: Record<string, string> = {};
                              matchResult.groups.forEach((group, i) => {
                                if (i < allSubs.length) {
                                  const sub = allSubs[i];
                                  const label = String(sub?.label || sub?.name || `group${i + 1}`).toLowerCase();
                                  extracted[label] = group;
                                }
                              });
                              matchResult.extracted = extracted;
                            }
                          }
                        } catch (e) {
                          // Invalid regex
                        }
                      }


                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            gap: 8,
                            alignItems: 'stretch',
                            minHeight: 40,
                          }}
                        >
                          {/* Left column: Test value with remove button */}
                          <div
                            style={{
                              flex: '0 0 45%',
                              padding: '8px',
                              background: '#0f172a',
                              borderRadius: 4,
                              fontSize: 11,
                              color: '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: '1px solid #334155',
                            }}
                          >
                            <span style={{ flex: 1 }}>{testCase}</span>
                            <button
                              onClick={() => setTestCases((prev) => prev.filter((_, i) => i !== idx))}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                fontSize: 12,
                                marginLeft: 8,
                              }}
                            >
                              ×
                            </button>
                          </div>

                          {/* Right column: Matched value (green) or No match (red) */}
                          <div
                            style={{
                              flex: '0 0 45%',
                              padding: '8px',
                              background: matchResult.matched ? '#064e3b' : '#7f1d1d',
                              borderRadius: 4,
                              border: `1px solid ${matchResult.matched ? '#059669' : '#dc2626'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              minWidth: 150,
                            }}
                          >
                            {matchResult.matched ? (
                              <div style={{ fontSize: 11, color: '#a7f3d0', width: '100%' }}>
                                {matchResult.fullMatch ? (
                                  <span style={{ wordBreak: 'break-word' }}>{matchResult.fullMatch}</span>
                                ) : (
                                  <span>✓</span>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: '#fca5a5' }}>✗</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '8px 0' }}>
                    Nessun test case. Aggiungi valori da testare.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

