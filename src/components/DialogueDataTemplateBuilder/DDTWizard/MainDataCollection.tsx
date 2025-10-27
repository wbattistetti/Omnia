import React from 'react';
import { Folder, Plus } from 'lucide-react';
import MainDataWizard from './MainDataWizard';

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

interface MainDataCollectionProps {
  rootLabel: string;
  mains: SchemaNode[];
  onChangeMains: (next: SchemaNode[]) => void;
  onAddMain: () => void;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onAutoMap?: (fieldLabel: string, fieldIndex: number) => Promise<void>;
}

const MainDataCollection: React.FC<MainDataCollectionProps & { progressByPath?: Record<string, number>, autoEditIndex?: number | null, onChangeEvent?: (e: any) => void }> = ({ rootLabel, mains, onChangeMains, onAddMain, progressByPath, selectedIdx, onSelect, autoEditIndex, onChangeEvent, onAutoMap }) => {
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
  // handleAddSubAt removed (plus now inline in MainDataWizard)

  // const showRootLabel = mains.length > 1;
  return (
    <div style={{ background: '#0f172a', borderRadius: 12, padding: 16, color: '#e2e8f0', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {/* 📍 "Create a dialogue for" + Percentuale inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Create a dialogue for</div>
          {/* Mostra percentuale solo se presente */}
          {(((progressByPath as any)?.__root__ || 0) > 0) && (() => {
            const percentage = Math.round(((progressByPath as any)?.__root__ || 0) * 100);
            return (
              <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600 }}>
                {percentage}%
              </span>
            );
          })()}
        </div>
        <button
          onClick={onAddMain}
          title="Add data"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: '1px solid #7c3aed',
            color: '#7c3aed',
            padding: '6px 10px',
            borderRadius: 999,
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          <span>Add data</span>
        </button>
      </div>
      {mains.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {/* 📐 Riga 1: Label + Percentuale inline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, whiteSpace: 'nowrap', fontSize: 16, padding: '4px 10px', borderRadius: 12, border: '1px solid #334155', background: '#1f2937', color: '#e2e8f0' }}>
              <Folder size={18} color="#fb923c" />
              {rootLabel}
            </span>
            {/* 📍 Percentuale subito dopo il testo */}
            {(((progressByPath as any)?.__root__ || 0) > 0) && (() => {
              const percentage = Math.round(((progressByPath as any)?.__root__ || 0) * 100);
              return (
                <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 600, marginLeft: 4 }}>
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
            <MainDataWizard
              node={m}
              onChange={(n) => handleChangeAt(i, n)}
              onRemove={() => handleRemoveAt(i)}
              progressByPath={progressByPath}
              selected={selectedIdx === i}
              autoEdit={autoEditIndex === i}
              pathPrefix={m.label}
              onChangeEvent={onChangeEvent}
              onRequestOpen={() => onSelect(i)}
              onAutoMap={onAutoMap}
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

export default MainDataCollection;
