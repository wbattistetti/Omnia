import React from 'react';
import EditorPanel, { type CustomLanguage } from '../../../CodeEditor/EditorPanel';

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

  // Track if regex was initially empty
  const wasInitiallyEmpty = React.useRef(!regex || regex.trim().length === 0);
  const [currentRegexValue, setCurrentRegexValue] = React.useState(regex);

  // Validate regex whenever it changes
  React.useEffect(() => {
    if (currentRegexValue && currentRegexValue.trim().length > 0) {
      const validation = validateRegexGroups(currentRegexValue, node);
      setValidationResult(validation);
    } else {
      setValidationResult(null);
    }
  }, [currentRegexValue, node]);

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
  // - AND user has edited (so button appears only after user modifies textbox)
  const shouldShowButton = !generatingRegex && hasUserEdited;

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

    // If regex is invalid, include validation errors in the prompt
    if (validationResult && !validationResult.valid && validationResult.errors.length > 0) {
      const errorsText = validationResult.errors.join('. ');
      const warningsText = validationResult.warnings.length > 0 ? ' Warnings: ' + validationResult.warnings.join('. ') : '';
      prompt = `Current regex: ${currentRegexValue}\n\nErrors found: ${errorsText}${warningsText}\n\nPlease fix the regex to include the correct capture groups. Expected ${validationResult.groupsExpected} capture groups for: ${(() => {
        const allSubs = [...((node?.subSlots || [])), ...(node?.subData || [])];
        return allSubs.map((s: any) => s.label || s.name || 'sub-data').join(', ');
      })()}`;
      console.log('[AI Regex] 🔵 Refine Regex clicked with validation errors, enhancing prompt');
    }

    if (!prompt.trim() || prompt.trim().length < 5) {
      console.log('[AI Regex] ❌ Prompt too short, cannot generate');
      return;
    }

    console.log('[AI Regex] 🔵 ' + getButtonLabel() + ' clicked, starting generation immediately');
    console.log('[AI Regex] 🔵 Using prompt:', prompt);

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

        if (data.explanation) {
          console.log('[AI Regex] ✅ Explanation:', data.explanation);
          console.log('[AI Regex] ✅ Examples:', data.examples);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Validation badge */}
          {validationResult && currentRegexValue && currentRegexValue.trim().length > 0 && (
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
              }}
              title={
                validationResult.valid
                  ? 'All capture groups are correctly configured'
                  : validationResult.errors.join('; ')
              }
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
            onClick={onClose}
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
            gap: 8,
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
        </div>
      </div>
    </div>
  );
}

