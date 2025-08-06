import React, { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import SmartTooltip from '../../SmartTooltip';
import { TooltipWrapper } from '../../TooltipWrapper';

interface AIActionPanelProps {
  currentMessage: string;
  stepType: string;
  onGenerate: (exampleMessage: string, applyToAll: boolean) => void;
  onClose: () => void;
  isGenerating?: boolean;
}

const AIActionPanel: React.FC<AIActionPanelProps> = ({
  currentMessage,
  stepType,
  onGenerate,
  onClose,
  isGenerating = false
}) => {
  const [exampleMessage, setExampleMessage] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);

  const handleGenerate = () => {
    if (exampleMessage.trim()) {
      onGenerate(exampleMessage.trim(), applyToAll);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleGenerate();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2 shadow-lg"
      style={{ 
        background: 'rgba(255,255,255,0.95)', 
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 8,
        padding: 16,
        marginTop: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Bot size={16} style={{ color: '#a21caf' }} />
        <span style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>
          Rewrite message style
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            marginLeft: 'auto',
            fontSize: 18,
            padding: 0,
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close AI panel"
        >
          ×
        </button>
      </div>



      {/* Example message input */}
      <div className="mb-3">
        <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
          Example message style:
        </label>
        <textarea
          value={exampleMessage}
          onChange={(e) => setExampleMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="E.g., Please tell me your birth year (YYYY) or Could you provide your email address?"
          style={{
            width: '100%',
            minHeight: 60,
            padding: 8,
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 13,
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
          rows={3}
        />
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
          Tip: Press Ctrl+Enter to generate
        </div>
      </div>

      {/* Generate button and checkbox on same row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={!exampleMessage.trim() || isGenerating}
          style={{
            background: exampleMessage.trim() && !isGenerating ? '#a21caf' : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: exampleMessage.trim() && !isGenerating ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background-color 0.2s'
          }}
        >
          {isGenerating ? (
            <>
              <div style={{
                width: 12,
                height: 12,
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate
            </>
          )}
        </button>

        {/* Apply to all checkbox - moved next to Generate button */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            style={{ accentColor: '#a21caf' }}
          />
          <span style={{ fontSize: 13, color: '#374151' }}>
            Apply to all <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 2 }}>{stepType}</code>
          </span>
        </label>
        
        <TooltipWrapper tooltip={
          <SmartTooltip 
            text="Provide an example of how you want the message to sound. The AI will rewrite the current message following your style." 
            tutorId="ai_example_help"
          >
            <span />
          </SmartTooltip>
        }>
          {(show, triggerProps) => (
            <button
              {...triggerProps}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'help',
                fontSize: 16,
                padding: 4
              }}
              title="Help"
            >
              ?
            </button>
          )}
        </TooltipWrapper>
      </div>
    </div>
  );
};

export default AIActionPanel; 