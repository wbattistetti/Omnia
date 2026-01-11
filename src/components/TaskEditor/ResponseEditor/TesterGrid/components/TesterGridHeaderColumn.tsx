import React from 'react';
import { Wand2, TypeIcon } from 'lucide-react';
import SmartTooltip from '../../../../SmartTooltip';

interface TesterGridHeaderColumnProps {
  type: 'regex' | 'deterministic' | 'ner' | 'llm' | 'embeddings';
  mainLabel: string;
  techLabel: string;
  tooltip: string;
  backgroundColor: string;
  enabled: boolean;
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  onToggleMethod: () => void;
  onToggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  showPostProcess?: boolean;
}

/**
 * Reusable header column component for extractor columns
 */
export default function TesterGridHeaderColumn({
  type,
  mainLabel,
  techLabel,
  tooltip,
  backgroundColor,
  enabled,
  activeEditor,
  onToggleMethod,
  onToggleEditor,
  showPostProcess = false,
}: TesterGridHeaderColumnProps) {
  const isEditorActive = activeEditor === type || (type === 'deterministic' && activeEditor === 'extractor') || (type === 'deterministic' && activeEditor === 'post');
  const shouldHide = activeEditor && ['regex', 'extractor', 'ner', 'llm'].includes(activeEditor) && !isEditorActive;

  return (
    <th
      style={{
        textAlign: 'left',
        padding: 8,
        background: backgroundColor,
        opacity: enabled ? 1 : 0.4,
        visibility: shouldHide ? 'hidden' : 'visible'
      }}
      title={tooltip}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggleMethod}
            style={{ cursor: 'pointer' }}
            disabled={type === 'embeddings'}
          />
          <div>
            <span style={{ fontWeight: 600, color: enabled ? '#0b0f17' : '#9ca3af' }}>{mainLabel}</span>
            <span style={{ opacity: 0.7, marginLeft: 4, color: enabled ? '#0b0f17' : '#9ca3af' }}>({techLabel})</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {type === 'deterministic' && showPostProcess ? (
            <>
              <SmartTooltip text="Configure Extractor" tutorId="configure_extractor_help" placement="bottom">
                <button
                  onClick={() => onToggleEditor('extractor')}
                  style={{
                    background: activeEditor === 'extractor' ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <Wand2 size={14} color={activeEditor === 'extractor' ? '#fff' : '#666'} />
                </button>
              </SmartTooltip>
              <SmartTooltip text="Configure Post Process" tutorId="configure_post_help" placement="bottom">
                <button
                  onClick={() => onToggleEditor('post')}
                  style={{
                    background: activeEditor === 'post' ? '#10b981' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <TypeIcon size={14} color={activeEditor === 'post' ? '#fff' : '#666'} />
                </button>
              </SmartTooltip>
            </>
          ) : (
            <button
              onClick={() => onToggleEditor(type === 'deterministic' ? 'extractor' : type)}
              title={`Configure ${techLabel}`}
              style={{
                background: isEditorActive ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              <Wand2 size={14} color={isEditorActive ? '#fff' : '#666'} />
            </button>
          )}
        </div>
      </div>
    </th>
  );
}
