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
}

const MainDataCollection: React.FC<MainDataCollectionProps & { progressByPath?: Record<string, number>, autoEditIndex?: number | null, onChangeEvent?: (e: any) => void }> = ({ rootLabel, mains, onChangeMains, onAddMain, progressByPath, selectedIdx, onSelect, autoEditIndex, onChangeEvent }) => {
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
        <div style={{ fontWeight: 700 }}>Create a dialogue for</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, whiteSpace: 'nowrap', fontSize: 16, padding: '4px 10px', borderRadius: 12, border: '1px solid #334155', background: '#1f2937', color: '#e2e8f0' }}>
            <Folder size={18} color="#fb923c" />
            {rootLabel}
          </span>
          {(((progressByPath as any)?.__root__ || 0) > 0) && (
            <>
              <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 9999, overflow: 'hidden', marginLeft: 8 }}>
                <div style={{ width: `${Math.round(((progressByPath as any)?.__root__ || 0) * 100)}%`, height: '100%', background: '#fb923c' }} />
              </div>
              <span style={{ fontSize: 11, color: '#93c5fd', minWidth: 34, textAlign: 'left' }}>{Math.round((((progressByPath as any)?.__root__ || 0) * 100))}%</span>
            </>
          )}
        </div>
      )}
      {/* Root progress also when a single main exists */}
      {mains.length <= 1 && (((progressByPath as any)?.__root__ || 0) > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(((progressByPath as any)?.__root__ || 0) * 100)}%`, height: '100%', background: '#fb923c' }} />
          </div>
          <span style={{ fontSize: 11, color: '#93c5fd', minWidth: 34, textAlign: 'left' }}>{Math.round((((progressByPath as any)?.__root__ || 0) * 100))}%</span>
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
