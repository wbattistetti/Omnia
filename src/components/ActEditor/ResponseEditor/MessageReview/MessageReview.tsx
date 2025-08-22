import React from 'react';
import { LayoutGrid, List, X as XIcon } from 'lucide-react';
import PanelMessages from './PanelMessages';

type StyleParams = {
  style: 'formal' | 'informal' | 'neutral';
  verbosity: 'concise' | 'medium' | 'verbose';
};

const DEFAULT_STYLE: StyleParams = {
  style: 'neutral',
  verbosity: 'medium',
};

export default function MessageReview({ ddt, translations }: { ddt: any; translations: Record<string, string> }) {
  const [panels, setPanels] = React.useState<Array<{ id: string; params: StyleParams; multi: boolean }>>([{ id: 'p1', params: DEFAULT_STYLE, multi: false }]);
  const [activeId, setActiveId] = React.useState<string>('p1');

  const updateParam = (key: keyof StyleParams, value: any) => {
    setPanels((prev) => prev.map((p) => (p.id === activeId ? { ...p, params: { ...p.params, [key]: value } } : p)));
  };

  const addPanel = () => {
    const id = `p${Math.random().toString(36).slice(2, 8)}`;
    setPanels((prev) => [...prev, { id, params: DEFAULT_STYLE, multi: false }]);
    setActiveId(id);
  };
  const removePanel = (id: string) => {
    setPanels((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const ensured = next.length > 0 ? next : [{ id: `p${Math.random().toString(36).slice(2, 8)}`, params: DEFAULT_STYLE, multi: false }];
      const stillActive = ensured.some((p) => p.id === activeId);
      if (!stillActive) {
        try { setActiveId(ensured[0].id); } catch {}
      }
      return ensured;
    });
  };
  const toggleMulti = (id: string) => setPanels(prev => prev.map(p => p.id === id ? { ...p, multi: !p.multi } : p));

  const makeCombo = (label: keyof StyleParams, values: string[]) => (
    <label key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label === 'style' && (
        <span style={{ fontSize: 12, color: '#475569', width: 60, textTransform: 'capitalize' }}>Style</span>
      )}
      <select value={(panels.find(p => p.id === activeId)?.params as any)[label]} onChange={(e) => updateParam(label, e.target.value as any)} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 8px' }}>
        {values.map(v => (<option key={v} value={v}>{v}</option>))}
      </select>
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {makeCombo('style', ['formal', 'informal', 'neutral'])}
        {makeCombo('verbosity', ['concise', 'medium', 'verbose'])}
        <span style={{ marginLeft: 'auto' }} />
        <button onClick={addPanel} title="Add panel" style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>+ Panel</button>
      </div>
      {/* Panels row */}
      <div style={{ display: 'flex', gap: 8, padding: 8, overflow: 'auto', height: '100%' }}>
        {panels.map((p) => (
          <div key={p.id} style={{ border: p.id === activeId ? '2px solid #0ea5e9' : '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: 'white', display: 'flex', flexDirection: 'column', flex: '1 1 560px', minWidth: 420 }}>
            <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
              <input type="radio" checked={activeId === p.id} onChange={() => setActiveId(p.id)} />
              {/* style chips summary */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(p.params).map(([k, v]) => (
                  <span key={`${k}:${String(v)}`} style={{ fontSize: 11, background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe', borderRadius: 12, padding: '2px 8px', textTransform: 'capitalize' }}>{k}: {String(v)}</span>
                ))}
              </div>
              <span style={{ marginLeft: 'auto' }} />
              <button onClick={() => toggleMulti(p.id)} title={p.multi ? 'Single column' : 'Multi-column'} style={{ background: 'transparent', border: '1px solid #0ea5e9', color: '#0ea5e9', borderRadius: 8, padding: 6, lineHeight: 0, cursor: 'pointer' }}>
                {p.multi ? <List size={16} /> : <LayoutGrid size={16} />}
              </button>
              <button onClick={() => removePanel(p.id)} title="Remove panel" style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, padding: 6, lineHeight: 0, cursor: 'pointer' }}>
                <XIcon size={16} />
              </button>
            </div>
            <PanelMessages ddt={ddt} translations={translations} multiColumn={p.multi} styleChips={Object.entries(p.params).map(([k, v]) => ({ key: k, value: String(v) }))} />
          </div>
        ))}
      </div>
    </div>
  );
}


