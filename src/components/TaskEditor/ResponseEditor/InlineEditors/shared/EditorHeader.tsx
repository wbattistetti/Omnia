import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ExtractorType } from '@responseEditor/hooks/useEditorMode';

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
  hideButton?: boolean; // Hide button (for overlay header)
  onButtonRender?: (button: React.ReactNode) => void; // Callback to render button elsewhere
  buttonCaption?: string; // Optional custom button caption
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
  hideButton = false,
  onButtonRender,
  buttonCaption,
}: EditorHeaderProps) {
  const getButtonLabel = () => {
    // Use custom caption if provided, otherwise use default
    if (buttonCaption) {
      return buttonCaption;
    }
    const typeLabels: Record<ExtractorType, string> = {
      regex: 'Regex',
      extractor: 'Extractor',
      ner: 'NER',
      llm: 'LLM Prompt',
    };
    return isCreateMode ? `Create ${typeLabels[extractorType]}` : `Refine ${typeLabels[extractorType]}`;
  };

  const buttonElement = shouldShowButton && !hideButton ? (
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
  ) : null;

  // If onButtonRender callback is provided, call it with the button
  React.useEffect(() => {
    if (onButtonRender && shouldShowButton) {
      const button = (
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
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: isGenerating ? 0.7 : 1,
            whiteSpace: 'nowrap', // ✅ Prevent wrapping
            minWidth: 'fit-content', // ✅ Ensure button doesn't shrink
            flexShrink: 0, // ✅ Prevent shrinking in flex layout
          }}
        >
          {isGenerating && <Loader2 size={14} className="animate-spin" />}
          {getButtonLabel()}
        </button>
      );
      onButtonRender(button);
    } else if (onButtonRender) {
      onButtonRender(null);
    }
  }, [shouldShowButton, isCreateMode, isGenerating, onButtonClick, getButtonLabel, onButtonRender]);

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
        {title && <h3 style={{ margin: 0, fontWeight: 600 }}>{title}</h3>}
        {validationBadge && <div style={{ flexShrink: 0 }}>{validationBadge}</div>}
        {errorMessage && (
          <span
            style={{
              color: '#ef4444',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              lineHeight: 1.4,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {buttonElement}
        {/* Pulsante Close rimosso - la X è già nell'header dell'overlay */}
      </div>
    </div>
  );
}

