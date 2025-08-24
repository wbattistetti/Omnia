import React from 'react';

function measureTextWidth(text: string, font: string): number {
  const canvas = (measureTextWidth as any)._canvas || ((measureTextWidth as any)._canvas = document.createElement('canvas'));
  const context = canvas.getContext('2d');
  if (!context) return text.length * 8;
  context.font = font;
  const metrics = context.measureText(text || '');
  const padding = 12; // left+right inner padding of the pill
  return Math.ceil(metrics.width + padding);
}

interface OperationListItem {
  id: string;
  name: string;
  method: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH';
  path: string;
}

interface Operation extends OperationListItem {
  inputs: string[];  // alias Omnia
  outputs: string[]; // alias Omnia
}

function OperationList({ items, selectedId, onSelect, onAdd }: { items: OperationListItem[]; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Operations</div>
        <button onClick={onAdd} style={{ padding: '4px 8px', border: '1px solid #333', borderRadius: 6 }}>+ Add</button>
      </div>
      {items.map(op => (
        <button key={op.id} onClick={() => onSelect(op.id)} style={{
          textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: '1px solid #333', background: selectedId === op.id ? '#1f2937' : 'transparent', color: '#e5e7eb'
        }}>
          <span style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555', marginRight: 8 }}>{op.method}</span>
          <strong>{op.path}</strong>
          <div style={{ color: '#9ca3af', fontSize: 12 }}>{op.name}</div>
        </button>
      ))}
    </div>
  );
}

export default function BackendInterfaceEditor() {
  const [ops, setOps] = React.useState<Operation[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);

  function handleAdd() {
    const id = String(Math.random());
    const next: Operation = { id, name: 'NuovaOperation', method: 'POST', path: '/my/operation', inputs: [], outputs: [] };
    setOps(prev => [next, ...prev]);
    setSelectedId(id);
  }

  const selected = ops.find(o => o.id === selectedId);

  function updateSelected(patch: Partial<Operation>) {
    if (!selected) return;
    setOps(prev => prev.map(o => o.id === selected.id ? { ...o, ...patch } : o));
  }

  const [newInputDraft, setNewInputDraft] = React.useState<string>('');
  const [newOutputDraft, setNewOutputDraft] = React.useState<string>('');
  React.useEffect(() => { setNewInputDraft(''); setNewOutputDraft(''); }, [selectedId]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, minHeight: 0 }}>
      <aside style={{ borderRight: '1px solid #222', paddingRight: 12 }}>
        <OperationList items={ops} selectedId={selectedId} onSelect={setSelectedId} onAdd={handleAdd} />
      </aside>
      <section style={{ minHeight: 0 }}>
        {!selected && <div style={{ color: '#9ca3af' }}>Crea o seleziona un'operation dell'interfaccia</div>}
        {selected && <div style={{ border: '1px solid #333', borderRadius: 8, padding: 12, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={selected.method}
              onChange={(e) => updateSelected({ method: e.target.value as Operation['method'] })}
              style={{ background: 'transparent', border: '1px solid #555', color: '#e5e7eb', padding: '2px 6px', borderRadius: 4 }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
            <input
              value={selected.name}
              onChange={(e) => updateSelected({ name: e.target.value })}
              placeholder="scrivi il nome del backend..."
              style={{
                background: 'transparent', border: '1px solid #333', color: '#e5e7eb', padding: '6px 8px', borderRadius: 6, width: 320
              }}
            />
          </div>

          <div style={{ border: '1px solid #333', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gap: 6, alignContent: 'start', justifyItems: 'start' }}>
              {selected.inputs.map((alias, idx) => (
                <span key={`in-${idx}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 12, justifySelf: 'start',
                  background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.6)', color: '#93c5fd'
                }}>
                  <input
                    value={alias}
                    onChange={(e) => {
                      const next = [...selected.inputs]; next[idx] = e.target.value; updateSelected({ inputs: next });
                    }}
                    placeholder="alias input"
                    size={1}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 12, width: measureTextWidth(alias || 'alias input', '12px sans-serif') }}
                  />
                </span>
              ))}
              <span
                title="write an input..."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 12, justifySelf: 'start',
                  background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.6)', color: '#93c5fd'
                }}
              >
                <input
                  value={newInputDraft}
                  onChange={(e) => setNewInputDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = newInputDraft.trim();
                      if (v) { updateSelected({ inputs: [...selected.inputs, v] }); setNewInputDraft(''); }
                    }
                  }}
                  placeholder="write an input..."
                  size={1}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 12, width: measureTextWidth(newInputDraft || 'write an input...', '12px sans-serif') }}
                />
              </span>

            </div>
            <div style={{ display: 'grid', gap: 6, alignContent: 'start', justifyItems: 'start' }}>
              {selected.outputs.map((alias, idx) => (
                <span key={`out-${idx}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 12, justifySelf: 'start',
                  background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.6)', color: '#a7f3d0'
                }}>
                  <input
                    value={alias}
                    onChange={(e) => {
                      const next = [...selected.outputs]; next[idx] = e.target.value; updateSelected({ outputs: next });
                    }}
                    placeholder="alias output"
                    size={1}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 12, width: measureTextWidth(alias || 'alias output', '12px sans-serif') }}
                  />
                </span>
              ))}
              <span
                title="write an output..."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 12, justifySelf: 'start',
                  background: 'rgba(52,211,153,0.18)', border: '1px solid rgba(52,211,153,0.6)', color: '#a7f3d0'
                }}
              >
                <input
                  value={newOutputDraft}
                  onChange={(e) => setNewOutputDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = newOutputDraft.trim();
                      if (v) { updateSelected({ outputs: [...selected.outputs, v] }); setNewOutputDraft(''); }
                    }
                  }}
                  placeholder="write an output..."
                  size={1}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 12, width: measureTextWidth(newOutputDraft || 'write an output...', '12px sans-serif') }}
                />
              </span>
            </div>
          </div>
        </div>}
      </section>
    </div>
  );
}


