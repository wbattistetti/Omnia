import React from 'react';
import EditorHeader from './shared/EditorHeader';
import TestValuesColumn, { type TestResult } from './shared/TestValuesColumn';
import { useEditorMode } from '../hooks/useEditorMode';
import { useTestValues } from '../hooks/useTestValues';
import { NLPProfile } from '../NLPExtractorProfileEditor';

interface NERInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  onProfileUpdate?: (profile: NLPProfile) => void;
}

/**
 * Inline editor for configuring NER (Named Entity Recognition)
 * Unified with other extractors: Create/Refine button, TestValuesColumn
 */
export default function NERInlineEditor({
  onClose,
  node,
  profile,
  onProfileUpdate,
}: NERInlineEditorProps) {
  const [nerConfig, setNerConfig] = React.useState<string>('{}'); // JSON config placeholder
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const [generating, setGenerating] = React.useState<boolean>(false);

  // Use unified test values hook
  const { testCases, setTestCases } = useTestValues(
    profile || { slotId: '', locale: 'it-IT', kind: 'generic', synonyms: [] },
    onProfileUpdate || (() => {})
  );

  // Use unified editor mode hook
  const { currentValue, setCurrentValue, isCreateMode } = useEditorMode({
    initialValue: nerConfig,
    templateValue: '{}',
    hasUserEdited,
    extractorType: 'ner',
  });

  // Sync currentValue with nerConfig
  React.useEffect(() => {
    setNerConfig(currentValue);
  }, [currentValue]);

  // Track user edits
  React.useEffect(() => {
    if (nerConfig !== '{}' && nerConfig.trim() !== '{}') {
      if (!hasUserEdited) {
        setHasUserEdited(true);
      }
    }
  }, [nerConfig, hasUserEdited]);

  // Test function for TestValuesColumn (placeholder - NER testing logic to be implemented)
  const testNER = React.useCallback((value: string): TestResult => {
    try {
      // Placeholder: NER testing logic to be implemented
      // For now, return a simple match check
      const matched = value && value.trim().length > 0;
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
  }, []);

  // Unified button click handler
  const handleButtonClick = async () => {
    setGenerating(true);

    try {
      // Placeholder: NER generation/refinement API call to be implemented
      // For now, simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Placeholder response
      const newConfig = JSON.stringify({ enabled: true, minConfidence: 0.7 }, null, 2);
      setNerConfig(newConfig);
      setCurrentValue(newConfig);
      setHasUserEdited(false);
    } catch (error) {
      console.error('[NEREditor] Error:', error);
      alert('Error configuring NER. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  // Show button if user edited or there are unmatched test cases
  const hasUnmatchedTests = testCases.some(tc => !testNER(tc).matched);
  const shouldShowButton = !generating && (hasUserEdited || hasUnmatchedTests);

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
        title="🪄 Configure NER"
        extractorType="ner"
        isCreateMode={isCreateMode}
        isGenerating={generating}
        shouldShowButton={shouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={onClose}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 0,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {/* NER Config Editor (placeholder - to be replaced with proper editor) */}
        <div
          style={{
            flex: 3,
            minWidth: 0,
            flexShrink: 1,
            overflow: 'hidden',
            padding: 16,
            border: '1px solid #334155',
            borderRadius: 8,
            background: '#1e1e1e',
            color: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 500,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p>NER configuration editor coming soon...</p>
            <p style={{ marginTop: 8, color: '#64748b' }}>
              Enable/disable NER and set confidence threshold
            </p>
          </div>
        </div>

        {/* Test Values Column */}
        <TestValuesColumn
          testCases={testCases}
          onTestCasesChange={setTestCases}
          testFunction={testNER}
          extractorType="ner"
          node={node}
          enabled={true}
        />
      </div>
    </div>
  );
}
