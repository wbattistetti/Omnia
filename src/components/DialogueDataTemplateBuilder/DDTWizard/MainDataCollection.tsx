// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { SchemaNode } from '../../TaskTreeBuilder/TaskTreeWizard/dataCollection';

export interface DataCollectionProps {
  rootLabel: string;
  onChangeRootLabel?: (newLabel: string) => void;
  mains: SchemaNode[];
  onChangeMains: (mains: SchemaNode[]) => void;
  onAddMain?: (label: string) => void;
  progressByPath?: Record<string, any>;
  fieldProcessingStates?: Record<string, any>;
  selectedIdx?: number | null;
  onSelect?: (idx: number) => void;
  autoEditIndex?: number | null;
  onChangeEvent?: (event: any) => void;
  onAutoMap?: (nodeId: string) => void;
  onRetryField?: (nodeId: string) => void;
  onCreateManually?: (nodeId: string) => void;
  compact?: boolean;
}

/**
 * MainDataCollection Component
 *
 * Displays the data structure with root label and mains.
 * Supports editing the root label when onChangeRootLabel is provided.
 */
const DataCollection: React.FC<DataCollectionProps> = ({
  rootLabel,
  onChangeRootLabel,
  mains,
  onChangeMains,
  onAddMain,
  progressByPath,
  fieldProcessingStates,
  selectedIdx,
  onSelect,
  autoEditIndex,
  onChangeEvent,
  onAutoMap,
  onRetryField,
  onCreateManually,
  compact = false,
}) => {
  const [isEditingRootLabel, setIsEditingRootLabel] = React.useState(false);
  const [rootLabelDraft, setRootLabelDraft] = React.useState(rootLabel);

  // Sync rootLabelDraft when rootLabel prop changes
  React.useEffect(() => {
    setRootLabelDraft(rootLabel);
  }, [rootLabel]);

  const handleRootLabelCommit = () => {
    if (rootLabelDraft.trim() && rootLabelDraft !== rootLabel && onChangeRootLabel) {
      onChangeRootLabel(rootLabelDraft.trim());
    }
    setIsEditingRootLabel(false);
  };

  const handleRootLabelCancel = () => {
    setRootLabelDraft(rootLabel);
    setIsEditingRootLabel(false);
  };

  return (
    <div style={{ padding: compact ? 4 : 8 }}>
      {/* Root Label - Editable if onChangeRootLabel is provided */}
      <div style={{ marginBottom: 8 }}>
        {isEditingRootLabel && onChangeRootLabel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus
              value={rootLabelDraft}
              onChange={(e) => setRootLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRootLabelCommit();
                } else if (e.key === 'Escape') {
                  handleRootLabelCancel();
                }
              }}
              style={{
                flex: 1,
                padding: '4px 8px',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '4px',
                color: '#e5e7eb',
                fontSize: compact ? 12 : 14,
              }}
            />
            <button
              onClick={handleRootLabelCommit}
              style={{
                padding: '4px 8px',
                backgroundColor: '#10b981',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
              }}
              title="Confirm"
            >
              ✓
            </button>
            <button
              onClick={handleRootLabelCancel}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
              }}
              title="Cancel"
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontWeight: 'bold',
                color: '#e5e7eb',
                fontSize: compact ? 14 : 16,
              }}
            >
              {rootLabel}
            </span>
            {onChangeRootLabel && (
              <button
                onClick={() => setIsEditingRootLabel(true)}
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                title="Edit root label"
              >
                ✎
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mains - Placeholder for now */}
      <div>
        {mains.length > 0 ? (
          <div>
            {mains.map((main, index) => (
              <div
                key={index}
                style={{
                  padding: '8px',
                  marginBottom: 4,
                  backgroundColor: '#1f2937',
                  borderRadius: '4px',
                  border: selectedIdx === index ? '2px solid #3b82f6' : '1px solid #374151',
                  cursor: onSelect ? 'pointer' : 'default',
                }}
                onClick={() => onSelect?.(index)}
              >
                <span style={{ color: '#e5e7eb', fontSize: compact ? 12 : 14 }}>
                  {main.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#9ca3af', fontSize: compact ? 12 : 14, fontStyle: 'italic' }}>
            No mains yet
          </div>
        )}
      </div>
    </div>
  );
};

export default DataCollection;
