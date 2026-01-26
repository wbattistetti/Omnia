import React from 'react';
import EditorHeader from './shared/EditorHeader';
// TestValuesColumn rimosso - ora è unico in DataExtractionEditor
import { type TestResult } from './shared/TestValuesColumn';
import { useEditorMode } from '../hooks/useEditorMode';
import { NLPProfile } from '../DataExtractionEditor';

interface NERInlineEditorProps {
  onClose: () => void;
  node?: any;
  profile?: NLPProfile;
  testCases?: string[]; // ✅ Test cases passed directly from useProfileState
  setTestCases?: (cases: string[]) => void; // ✅ Setter passed directly from useProfileState
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
  testCases: testCasesProp,
  setTestCases: setTestCasesProp,
  onProfileUpdate,
}: NERInlineEditorProps) {
  const [nerConfig, setNerConfig] = React.useState<string>('{}'); // JSON config placeholder
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

  // Use unified test values hook
  // No local state - read directly from profile (single source of truth)
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
      const matched = Boolean(value && value.trim().length > 0);
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
        extractorType="ner"
        isCreateMode={isCreateMode}
        isGenerating={generating}
        shouldShowButton={shouldShowButton}
        onButtonClick={handleButtonClick}
        onClose={onClose}
      />

      {/* NER Config Editor (placeholder - to be replaced with proper editor) */}
      <div
        style={{
          padding: 8,
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
    </div>
  );
}
