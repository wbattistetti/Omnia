import React from 'react';
import EditorPanel from '../../../CodeEditor/EditorPanel';
import EditorHeader from './shared/EditorHeader';
// TestValuesColumn rimosso - ora è unico in NLPExtractorProfileEditor
import { type TestResult } from './shared/TestValuesColumn';
import { useEditorMode } from '../hooks/useEditorMode';
import { NLPProfile } from '../NLPExtractorProfileEditor';

interface ExtractorInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  testCases?: string[]; // ✅ Test cases passed directly from useProfileState
  setTestCases?: (cases: string[]) => void; // ✅ Setter passed directly from useProfileState
  onProfileUpdate?: (profile: NLPProfile) => void;
}

const TEMPLATE_CODE = `// Estrazione non configurata
// Clicca "Create Extractor" per generare il codice estrattore da una descrizione

export const customExtractor: DataExtractor<string> = {
  extract(text: string) {
    return {
      confidence: 0,
      reasons: ['estrattore-non-configurato'],
      error: '❌ Estrazione non configurata. Genera il codice estrattore.'
    };
  },

  validate(value: string) {
    return { ok: false, errors: ['estrattore-non-configurato'] };
  },

  format(value: string) {
    return '⚠️ Configura estrazione';
  }
};`;

/**
 * Inline editor for configuring deterministic extractor with AI code generation
 * Uses Monaco Editor for TypeScript code editing
 * Unified with other extractors: Create/Refine button, TestValuesColumn
 */
export default function ExtractorInlineEditor({
  onClose,
  node,
  profile,
  testCases: testCasesProp,
  setTestCases: setTestCasesProp,
  onProfileUpdate,
}: ExtractorInlineEditorProps) {
  const [extractorCode, setExtractorCode] = React.useState<string>(TEMPLATE_CODE);
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
    initialValue: extractorCode,
    templateValue: TEMPLATE_CODE,
    hasUserEdited,
    extractorType: 'extractor',
  });

  // Sync currentValue with extractorCode
  React.useEffect(() => {
    setExtractorCode(currentValue);
  }, [currentValue]);

  // Track user edits
  React.useEffect(() => {
    if (extractorCode !== TEMPLATE_CODE && extractorCode.trim() !== TEMPLATE_CODE.trim()) {
      // Check if there's actual code beyond comments
      const codeWithoutComments = extractorCode.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const hasCode = codeWithoutComments.length > 50;
      if (hasCode && !hasUserEdited) {
        setHasUserEdited(true);
      }
    }
  }, [extractorCode, hasUserEdited]);

  // Test function for TestValuesColumn
  const testExtractor = React.useCallback((value: string): TestResult => {
    try {
      // Create a minimal context to evaluate the extractor
      // This is a simplified test - in production, you'd want to properly compile/run the TypeScript
      const matched = extractorCode.includes('extract') && extractorCode.includes(value || '');
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
  }, [extractorCode]);

  // Unified button click handler
  const handleButtonClick = async () => {
    let prompt = extractorCode || '';

    // Find test cases that don't match
    const unmatchedTestCases: string[] = [];
    if (extractorCode && extractorCode.trim() && testCases.length > 0) {
      testCases.forEach((testCase) => {
        const result = testExtractor(testCase);
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

    // Get AI provider and model from localStorage
    let provider = 'groq';
    let model: string | undefined = undefined;
    try {
      const savedProvider = localStorage.getItem('omnia.aiProvider') || 'groq';
      const savedModel = localStorage.getItem('omnia.aiModel');
      provider = savedProvider;
      model = savedModel || undefined;
    } catch (e) {
      console.warn('[ExtractorEditor] Could not read AI config from localStorage:', e);
    }

    try {
      const endpoint = isCreateMode
        ? '/api/nlp/generate-extractor'
        : '/api/nlp/refine-extractor';

      const body = isCreateMode
        ? {
          description: prompt,
          dataType: 'string',
          provider,
          model
        }
        : {
          code: extractorCode,
          improvements: prompt,
          dataType: 'string',
          provider,
          model
        };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.code) {
        setExtractorCode(data.code);
        setCurrentValue(data.code);
        setHasUserEdited(false);

        // ⚠️ Test cases are now generated at profile initialization, not here
      } else {
        alert(`AI ${isCreateMode ? 'generation' : 'refinement'} failed. Please try again.`);
      }
    } catch (error) {
      console.error(`[ExtractorEditor] AI ${isCreateMode ? 'generate' : 'refine'} error:`, error);
      alert(`Error ${isCreateMode ? 'generating' : 'refining'} extractor code. Check console for details.`);
    } finally {
      setGenerating(false);
    }
  };

  // Show button if user edited or there are unmatched test cases
  const hasUnmatchedTests = testCases.some(tc => !testExtractor(tc).matched);
  const shouldShowButton = !generating && (hasUserEdited || hasUnmatchedTests);

  // Close handler - validate if needed
  const handleClose = () => {
    // Close anyway behavior - always allow closing
    onClose();
  };

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
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
        extractorType="extractor"
        isCreateMode={isCreateMode}
        isGenerating={generating}
        shouldShowButton={shouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={handleClose}
      />

      {/* Monaco Editor */}
      <div>
        {generating ? (
          <div
            style={{
              height: 500,
              border: '1px solid #334155',
              borderRadius: 8,
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
              {isCreateMode ? '🪄 Generating extractor code...' : '🔄 Refining extractor code...'}
            </span>
          </div>
        ) : (
          <div style={{ height: 500, border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}>
            <EditorPanel
              code={extractorCode}
              onChange={(newCode) => {
                setExtractorCode(newCode);
                setCurrentValue(newCode);
                if (!hasUserEdited) setHasUserEdited(true);
              }}
              fontSize={13}
              varKeys={[]}
              language="typescript"
            />
          </div>
        )}
      </div>
    </div>
  );
}
