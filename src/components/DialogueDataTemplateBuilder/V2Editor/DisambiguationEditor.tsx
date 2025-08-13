import React from 'react';
import type { StepDisambiguation } from '../../DialogueDataEngine/model/ddt.v2.types';

type Props = {
  value: StepDisambiguation;
  onChange: (next: StepDisambiguation) => void;
};

export default function DisambiguationEditor({ value, onChange }: Props) {
  const v = React.useMemo<StepDisambiguation>(() => ({
    prompt: value?.prompt || '',
    softRanking: Boolean(value?.softRanking),
    defaultWithCancel: Boolean(value?.defaultWithCancel),
    selectionMode: value?.selectionMode || 'numbers',
  }), [value]);

  return (
    <div aria-label="v2-disambiguation" style={{ display: 'grid', gap: 8 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Prompt</label>
        <input
          value={v.prompt}
          onChange={(e) => onChange({ ...v, prompt: e.target.value })}
          style={{ width: '100%', border: '1px solid #ddd', padding: 8, borderRadius: 6 }}
          placeholder="Base disambiguation prompt"
        />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={v.softRanking} onChange={(e) => onChange({ ...v, softRanking: e.target.checked })} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Soft ranking</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={v.defaultWithCancel} onChange={(e) => onChange({ ...v, defaultWithCancel: e.target.checked })} />
          <span style={{ fontSize: 12, color: '#6b7280' }}>Default with cancel</span>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Selection mode</span>
          <select
            value={v.selectionMode}
            onChange={(e) => onChange({ ...v, selectionMode: e.target.value as any })}
            style={{ border: '1px solid #ddd', padding: 6, borderRadius: 6 }}
          >
            <option value="numbers">numbers</option>
            <option value="buttons">buttons</option>
            <option value="free_text">free_text</option>
          </select>
        </label>
      </div>
    </div>
  );
}


