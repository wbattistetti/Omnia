import React from 'react';
import EditorPanel from '../../../CodeEditor/EditorPanel';
import EditorHeader from './shared/EditorHeader';
// TestValuesColumn rimosso - ora è unico in DataExtractionEditor
import { type TestResult } from './shared/TestValuesColumn';
import { useEditorMode } from '../hooks/useEditorMode';
import { NLPProfile } from '../DataExtractionEditor';

interface LLMInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  testCases?: string[]; // ✅ Test cases passed directly from useProfileState
  setTestCases?: (cases: string[]) => void; // ✅ Setter passed directly from useProfileState
  onProfileUpdate?: (profile: NLPProfile) => void;
}

const TEMPLATE_PROMPT = `// LLM Prompt Template
// Describe what you want the AI to extract from user input

Extract the following information from the user's message:
- Field: [describe field name]
- Format: [describe expected format]
- Examples: [provide examples]
`;

/**
 * Inline editor for configuring LLM extraction prompt
 * Unified with other extractors: Create/Refine button, TestValuesColumn
 */
export default function LLMInlineEditor({
  onClose,
  node,
  profile,
  testCases: testCasesProp,
  setTestCases: setTestCasesProp,
  onProfileUpdate,
}: LLMInlineEditorProps) {
  const [llmPrompt, setLlmPrompt] = React.useState<string>(TEMPLATE_PROMPT);
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const [generating, setGenerating] = React.useState<boolean>(false);

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

  // Use unified editor mode hook
  const { currentValue, setCurrentValue, isCreateMode } = useEditorMode({
    initialValue: llmPrompt,
    templateValue: TEMPLATE_PROMPT,
    hasUserEdited,
    extractorType: 'llm',
  });

  // Sync currentValue with llmPrompt
  React.useEffect(() => {
    setLlmPrompt(currentValue);
  }, [currentValue]);

  // Track user edits
  React.useEffect(() => {
    if (llmPrompt !== TEMPLATE_PROMPT && llmPrompt.trim() !== TEMPLATE_PROMPT.trim()) {
      if (!hasUserEdited) {
        setHasUserEdited(true);
      }
    }
  }, [llmPrompt, hasUserEdited]);

  // Test function for TestValuesColumn (placeholder - LLM testing logic to be implemented)
  const testLLM = React.useCallback((value: string): TestResult => {
    try {
      // Placeholder: LLM testing logic to be implemented
      // For now, return a simple match check
      const matched = Boolean(value && value.trim().length > 0 && llmPrompt.includes('Extract'));
      return {
        matched,
        fullMatch: matched ? value : undefined,
      };
    } catch (error) {
      return {
        matched: false,
        error: String(error),
      };
    }
  }, [llmPrompt]);

  // Unified button click handler
  const handleButtonClick = async () => {
    let prompt = llmPrompt || '';

    // Find test cases that don't match
    const unmatchedTestCases: string[] = [];
    if (llmPrompt && llmPrompt.trim() && testCases.length > 0) {
      testCases.forEach((testCase) => {
        const result = testLLM(testCase);
        if (!result.matched) {
          unmatchedTestCases.push(testCase);
        }
      });
    }

    // Build prompt with validation errors if needed
    if (unmatchedTestCases.length > 0) {
      prompt += `\n\n⚠️ These test cases should match but currently don't:\n${unmatchedTestCases.map(tc => `- ${tc}`).join('\n')}`;
    }

    setGenerating(true);

    try {
      // Placeholder: LLM prompt generation/refinement API call to be implemented
      // For now, simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Placeholder response - improved prompt
      const newPrompt = llmPrompt + '\n\n// Refined by AI';
      setLlmPrompt(newPrompt);
      setCurrentValue(newPrompt);
      setHasUserEdited(false);

      // Save test cases from AI response if available
      // if (data.examples && Array.isArray(data.examples)) {
      //   setTestCases(data.examples);
      // }
    } catch (error) {
      console.error('[LLMEditor] Error:', error);
      alert('Error configuring LLM prompt. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  // Show button if user edited or there are unmatched test cases
  const hasUnmatchedTests = testCases.some(tc => !testLLM(tc).matched);
  const shouldShowButton = !generating && (hasUserEdited || hasUnmatchedTests);

  return (
    <div
      style={{
        padding: 8,
        background: '#f9fafb',
        animation: 'fadeIn 0.2s ease-in',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <EditorHeader
        title=""
        extractorType="llm"
        isCreateMode={isCreateMode}
        isGenerating={generating}
        shouldShowButton={shouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={onClose}
      />

        {/* Monaco Editor for LLM Prompt */}
      <div>
          {generating ? (
            <div
              style={{
                height: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1e1e1e',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: '3px solid #3b82f6',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ color: '#f1f5f9' }}>
                {isCreateMode ? '🪄 Generating LLM prompt...' : '🔄 Refining LLM prompt...'}
              </span>
            </div>
          ) : (
          <div style={{ height: 500, overflow: 'hidden' }}>
              <EditorPanel
                code={llmPrompt}
                onChange={(newPrompt) => {
                  setLlmPrompt(newPrompt);
                  setCurrentValue(newPrompt);
                  if (!hasUserEdited) setHasUserEdited(true);
                }}
                fontSize={13}
                varKeys={[]}
                language="markdown"
              />
            </div>
          )}
      </div>
    </div>
  );
}
