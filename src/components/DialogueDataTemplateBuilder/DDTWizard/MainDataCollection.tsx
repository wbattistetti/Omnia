import React from 'react';
import { Folder, Plus } from 'lucide-react';
import DataWizard from './MainDataWizard';
import { useFontContext } from '../../../context/FontContext';

export interface SchemaNode {
  label: string;
  type?: string;
  icon?: string;
  subData?: SchemaNode[];
  constraints?: Constraint[];
}

export interface Constraint {
  kind: 'required' | 'range' | 'length' | 'regex' | 'enum' | 'format' | 'pastDate' | 'futureDate';
  title: string;
  payoff: string;
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  values?: Array<string | number>;
  format?: string;
}

interface dataCollectionProps {
  rootLabel: string;
  mains: SchemaNode[];
  onChangeMains: (next: SchemaNode[]) => void;
  onAddMain: () => void;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onAutoMap?: (fieldLabel: string, fieldIndex: number) => Promise<void>;
  progressByPath?: Record<string, number>;
  fieldProcessingStates?: Record<string, any>;
  onRetryField?: (fieldId: string) => void;
  onCreateManually?: () => void;
  compact?: boolean; // ✅ Modalità compatta per conferma
}

const DataCollection: React.FC<dataCollectionProps & { progressByPath?: Record<string, number>, autoEditIndex?: number | null, onChangeEvent?: (e: any) => void }> = ({ rootLabel, mains, onChangeMains, onAddMain, progressByPath, fieldProcessingStates, selectedIdx, onSelect, autoEditIndex, onChangeEvent, onAutoMap, onRetryField, onCreateManually, compact = false }) => {
  const { combinedClass } = useFontContext();
  const handleChangeAt = (idx: number, nextNode: SchemaNode) => {
    const next = mains.slice();
    next[idx] = nextNode;
    onChangeMains(next);
  };
  const handleRemoveAt = (idx: number) => {
    const next = mains.slice();
    next.splice(idx, 1);
    onChangeMains(next);
  };
  // handleAddSubAt removed (plus now inline in dataWizard)

  // const showRootLabel = mains.length > 1;
  return (
    <div style={{
      background: compact ? 'transparent' : '#0f172a',
      borderRadius: compact ? 0 : 12,
      padding: compact ? 0 : 16,
      color: '#e2e8f0',
      marginTop: compact ? 0 : 16
    }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
          {/* Pulsante Add data più piccolo e in alto */}
          <button
            onClick={onAddMain}
            title="Add data"
            className={combinedClass}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: '1px solid #7c3aed',
              color: '#7c3aed',
              padding: '4px 8px',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            <Plus size={12} />
            <span>Add data</span>
          </button>
        </div>
      )}
      {mains.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {/* 📐 Riga 1: Label + Percentuale inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={combinedClass} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, whiteSpace: 'nowrap', padding: '4px 10px', borderRadius: 12, border: '1px solid #334155', background: '#1f2937', color: '#e2e8f0' }}>
              <Folder size={18} color="#fb923c" />
              {rootLabel}
            </span>
            {/* 📍 Percentuale subito dopo il testo */}
            {(((progressByPath as any)?.__root__ || 0) > 0) && (() => {
              const percentage = Math.round(((progressByPath as any)?.__root__ || 0) * 100);
              return (
                <span className={combinedClass} style={{ color: '#93c5fd', fontWeight: 600, marginLeft: 4 }}>
                  {percentage}%
                </span>
              );
            })()}
          </div>
          {/* 📐 Riga 2: Barra di progresso sotto, full width */}
          {(((progressByPath as any)?.__root__ || 0) > 0) && (() => {
            const percentage = Math.round(((progressByPath as any)?.__root__ || 0) * 100);
            const isComplete = percentage >= 100;
            const barColor = isComplete ? '#ef4444' : '#fbbf24';
            const barStyle = isComplete
              ? { background: barColor }
              : {
                background: `repeating-linear-gradient(
                    to right,
                    ${barColor} 0px,
                    ${barColor} 8px,
                    transparent 8px,
                    transparent 12px
                  )`
              };

            return (
              <div style={{ width: '100%', height: 6, background: '#1f2937', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ width: `${percentage}%`, height: '100%', ...barStyle, transition: 'width 0.8s ease, background 0.3s ease' }} />
              </div>
            );
          })()}
        </div>
      )}
      {/* Root progress also when a single main exists */}
      {mains.length <= 1 && (((progressByPath as any)?.__root__ || 0) > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {/* 📐 Barra di progresso sotto "Create a dialogue for", full width */}
          {(() => {
            const percentage = Math.round(((progressByPath as any)?.__root__ || 0) * 100);
            const isComplete = percentage >= 100;
            const barColor = isComplete ? '#ef4444' : '#fbbf24';
            const barStyle = isComplete
              ? { background: barColor }
              : {
                background: `repeating-linear-gradient(
                    to right,
                    ${barColor} 0px,
                    ${barColor} 8px,
                    transparent 8px,
                    transparent 12px
                  )`
              };

            return (
              <div style={{ width: '100%', height: 6, background: '#1f2937', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ width: `${percentage}%`, height: '100%', ...barStyle, transition: 'width 0.8s ease, background 0.3s ease' }} />
              </div>
            );
          })()}
        </div>
      )}
      <div>
        {mains.map((m, i) => (
          <div key={i} onClick={() => onSelect(i)}>
            <DataWizard
              node={m}
              onChange={(n) => handleChangeAt(i, n)}
              onRemove={() => handleRemoveAt(i)}
              progressByPath={progressByPath}
              fieldProcessingStates={fieldProcessingStates}
              selected={selectedIdx === i}
              autoEdit={autoEditIndex === i}
              pathPrefix={m.label}
              onChangeEvent={onChangeEvent}
              onRequestOpen={() => onSelect(i)}
              onAutoMap={onAutoMap}
              onRetryField={onRetryField}
              onCreateManually={onCreateManually}
            />
          </div>
        ))}
        {mains.length === 0 && (
          <div style={{ opacity: 0.8, fontStyle: 'italic', padding: 8 }}>No main data yet.</div>
        )}
      </div>
    </div>
  );
};

export default DataCollection;
