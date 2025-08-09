import React from 'react';
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
}

const MainDataCollection: React.FC<MainDataCollectionProps> = ({ rootLabel, mains, onChangeMains, onAddMain }) => {
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
  const handleAddSubAt = (idx: number) => {
    const next = mains.slice();
    const node = { ...(next[idx] || { label: '' }) } as SchemaNode;
    node.subData = Array.isArray(node.subData) ? node.subData.slice() : [];
    node.subData.push({ label: 'New field', type: 'text', icon: 'FileText' });
    next[idx] = node;
    onChangeMains(next);
  };

  const showRootLabel = mains.length > 1;
  return (
    <div style={{ background: '#0f172a', borderRadius: 12, padding: 16, color: '#e2e8f0', marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>{showRootLabel ? `Create a Dialogue for "${rootLabel}"` : 'Create a Dialogue for'}</div>
        <button onClick={onAddMain} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>Add main data</button>
      </div>
      <div>
        {mains.map((m, i) => (
          <MainDataWizard
            key={i}
            node={m}
            onChange={(n) => handleChangeAt(i, n)}
            onRemove={() => handleRemoveAt(i)}
            onAddSub={() => handleAddSubAt(i)}
          />
        ))}
        {mains.length === 0 && (
          <div style={{ opacity: 0.8, fontStyle: 'italic', padding: 8 }}>No main data yet.</div>
        )}
      </div>
    </div>
  );
};

export default MainDataCollection;
