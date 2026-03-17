import React from 'react';
import EditorPanel from '@components/CodeEditor/EditorPanel';
import EditorHeader from '@responseEditor/InlineEditors/shared/EditorHeader';
// TestValuesColumn rimosso - ora è unico in DataExtractionEditor
import { type TestResult } from '@responseEditor/InlineEditors/shared/TestValuesColumn';
import { useEditorMode } from '@responseEditor/hooks/useEditorMode';
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

interface LLMInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  testPhrases?: string[]; // ✅ Test phrases passed directly from useProfileState
  setTestPhrases?: (phrases: string[]) => void; // ✅ Setter passed directly from useProfileState
  onProfileUpdate?: (profile: NLPProfile) => void;
  contract?: DataContract | null;
  onContractChange?: (contract: DataContract) => void;
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
  testPhrases: testPhrasesProp,
  setTestPhrases: setTestPhrasesProp,
  onProfileUpdate,
  contract,
  onContractChange,
}: LLMInlineEditorProps) {
  // Build prompt from contract if aiPrompt is empty
  const buildPromptFromContract = React.useCallback((): string => {
    if (!contract) return TEMPLATE_PROMPT;

    const entity = contract.entity || {};
    const entityLabel = entity.label || node?.label || '';
    const entityDesc = entity.description || '';

    // Support both subentities (new) and subgroups (legacy)
    const subgroups = contract.subentities || contract.subgroups || [];

    // Build subentities description
    const subentitiesList: string[] = [];
    subgroups.forEach((sg: any) => {
      let subDesc = `- ${sg.subTaskKey || 'unknown'}: ${sg.label || ''}`;
      if (sg.meaning) subDesc += ` (${sg.meaning})`;
      if (sg.type) subDesc += ` [type: ${sg.type}]`;
      if (sg.constraints) subDesc += ` [constraints: ${JSON.stringify(sg.constraints)}]`;
      subentitiesList.push(subDesc);
    });

    // Get output format
    const outputFormat = contract.outputCanonical || {};
    const outputKeys = outputFormat.keys || [];

    // Build the prompt template
    let prompt = 'Extract information from the following text.\n\n';

    if (entityLabel) {
      prompt += `Entity to extract: ${entityLabel}\n`;
    }
    if (entityDesc) {
      prompt += `Description: ${entityDesc}\n`;
    }

    if (subentitiesList.length > 0) {
      prompt += '\nFields to extract:\n';
      prompt += subentitiesList.join('\n');
      prompt += '\n';
    }

    prompt += `\nOutput format: ${outputFormat.format || 'object'}\n`;
    if (outputKeys.length > 0) {
      prompt += `Output keys: ${outputKeys.join(', ')}\n`;
    }

    prompt += '\nText to analyze:\n{text}\n\n';
    prompt += 'Return a JSON object with the extracted values matching the output format above.';

    return prompt;
  }, [contract, node]);

  // Load prompt from contract or generate from contract
  const initialPrompt = React.useMemo(() => {
    if (!contract) return TEMPLATE_PROMPT;

    const engines = contract.engines || [];
    const llmParser = engines.find((p: any) => p.type === 'llm');

    if (llmParser?.aiPrompt && llmParser.aiPrompt.trim()) {
      // Use saved prompt if it exists and is not empty
      return llmParser.aiPrompt;
    } else {
      // Generate from contract - always show generated prompt instead of empty template
      const generated = buildPromptFromContract();
      // ✅ Only fallback to TEMPLATE_PROMPT if generated is empty or invalid
      return generated && generated.trim() ? generated : TEMPLATE_PROMPT;
    }
  }, [contract, buildPromptFromContract]);

  const [llmPrompt, setLlmPrompt] = React.useState<string>(initialPrompt);
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const [generating, setGenerating] = React.useState<boolean>(false);

  // Update prompt when contract changes
  React.useEffect(() => {
    if (!contract) return;

    const engines = contract.engines || [];
    const llmParser = engines.find((p: any) => p.type === 'llm');

    if (llmParser?.aiPrompt && llmParser.aiPrompt.trim() && llmParser.aiPrompt !== llmPrompt) {
      setLlmPrompt(llmParser.aiPrompt);
    } else if ((!llmParser?.aiPrompt || !llmParser.aiPrompt.trim()) && contract) {
      const generated = buildPromptFromContract();
      // ✅ Only update if generated is valid and different
      if (generated && generated.trim() && generated !== llmPrompt) {
        setLlmPrompt(generated);
      }
    }
  }, [contract, buildPromptFromContract, llmPrompt]);

  // ✅ Usa testPhrases da props se disponibili, altrimenti fallback a profile
  const testPhrases = testPhrasesProp || profile?.testPhrases || [];

  const setTestPhrases = React.useCallback((phrases: string[]) => {
    // ✅ Usa setter diretto se disponibile
    if (setTestPhrasesProp) {
      setTestPhrasesProp(phrases);
    } else if (onProfileUpdate && profile) {
      // Fallback: aggiorna tramite onProfileUpdate
      onProfileUpdate({ ...profile, testPhrases: phrases });
    }
  }, [setTestPhrasesProp, profile, onProfileUpdate]);

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

    // Find test phrases that don't match
    const unmatchedTestPhrases: string[] = [];
    if (llmPrompt && llmPrompt.trim() && testPhrases.length > 0) {
      testPhrases.forEach((testPhrase) => {
        const result = testLLM(testPhrase);
        if (!result.matched) {
          unmatchedTestPhrases.push(testPhrase);
        }
      });
    }

    // Build prompt with validation errors if needed
    if (unmatchedTestPhrases.length > 0) {
      prompt += `\n\n⚠️ These test phrases should match but currently don't:\n${unmatchedTestPhrases.map(tp => `- ${tp}`).join('\n')}`;
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

  // Show button if user edited or there are unmatched test phrases
  const hasUnmatchedTests = testPhrases.some(tp => !testLLM(tp).matched);
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
        title="LLM (LLM)"
        extractorType="llm"
        isCreateMode={isCreateMode}
        isGenerating={generating}
        shouldShowButton={shouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={() => {
          // Save prompt to contract when closing (validates/persists the prompt)
          if (contract && onContractChange && llmPrompt.trim()) {
            const engines = contract.engines || [];
            const llmParserIndex = engines.findIndex((p: any) => p.type === 'llm');

            if (llmParserIndex >= 0) {
              // Update existing LLM parser
              const updatedEngines = [...engines];
              updatedEngines[llmParserIndex] = {
                ...updatedEngines[llmParserIndex],
                aiPrompt: llmPrompt.trim(),
                systemPrompt: updatedEngines[llmParserIndex].systemPrompt || 'You are a data extraction expert. Always return valid JSON.'
              };
              onContractChange({
                ...contract,
                engines: updatedEngines
              });
            } else {
              // Create new LLM parser
              const newEngines = [
                ...engines,
                {
                  type: 'llm',
                  enabled: true,
                  systemPrompt: 'You are a data extraction expert. Always return valid JSON.',
                  aiPrompt: llmPrompt.trim(),
                  responseSchema: {}
                }
              ];
              onContractChange({
                ...contract,
                engines: newEngines
              });
            }
          }
          onClose();
        }}
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
