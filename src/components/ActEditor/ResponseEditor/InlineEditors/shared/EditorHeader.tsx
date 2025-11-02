import React from 'react';
import { Loader2 } from 'lucide-react';
import { ExtractorType } from '../../hooks/useEditorMode';

interface EditorHeaderProps {
  title: string;
  extractorType: ExtractorType;
  isCreateMode: boolean;
  isGenerating: boolean;
  shouldShowButton: boolean; // Show only if modified or there are errors
  onButtonClick: () => void;
  onClose: () => void;
  validationBadge?: React.ReactNode; // Optional validation badge
  errorMessage?: string; // Optional error message
}

/**
 * Standardized header component for all extractor editors
 * Includes Create/Refine button and validation feedback
 */
export default function EditorHeader({
  title,
  extractorType,
  isCreateMode,
  isGenerating,
  shouldShowButton,
  onButtonClick,
  onClose,
  validationBadge,
  errorMessage,
}: EditorHeaderProps) {
  const getButtonLabel = () => {
    const typeLabels: Record<ExtractorType, string> = {
      regex: 'Regex',
      extractor: 'Extractor',
      ner: 'NER',
      llm: 'LLM Prompt',
    };
    return isCreateMode ? `Create ${typeLabels[extractorType]}` : `Refine ${typeLabels[extractorType]}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
        {validationBadge && <div style={{ flexShrink: 0 }}>{validationBadge}</div>}
        {errorMessage && (
          <span
            style={{
              fontSize: 10,
              color: '#ef4444',
              fontStyle: 'italic',
              flex: 1,
              minWidth: 0,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              lineHeight: 1.4,
            }}
          >
            {errorMessage}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {shouldShowButton && (
          <button
            type="button"
            onClick={onButtonClick}
            disabled={isGenerating}
            style={{
              padding: '6px 12px',
              background: isCreateMode ? '#3b82f6' : '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            {isGenerating && <Loader2 size={14} className="animate-spin" />}
            {getButtonLabel()}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          ❌ Close
        </button>
      </div>
    </div>
  );
}

