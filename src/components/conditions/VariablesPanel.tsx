import React from 'react';

export default function VariablesPanel({
  variables,
  selected,
  onChange,
  onClose,
}: {
  variables: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClose?: () => void;
}) {
  const toggle = (key: string, checked: boolean) => {
    onChange(
      checked ? Array.from(new Set([...(selected || []), key])) : (selected || []).filter(x => x !== key)
    );
  };

  // Build Act/Main/Sub hierarchy from dotted keys: Act.Main[.Sub]
  const groups = React.useMemo(() => {
    // If a selection is provided, hide variables not selected
    const baseList = Array.isArray(variables) ? variables.filter(v => {
      if (!selected || selected.length === 0) return true;
      const mainKey = String(v).split('.').slice(0, 2).join('.');
      return selected.includes(v) || selected.includes(mainKey);
    }) : [];
    const map: Record<string, { mains: Record<string, string[]> }> = {};
    baseList.forEach(v => {
      const parts = String(v).split('.');
      if (parts.length === 0) return;
      const act = parts[0];
      const main = parts.slice(1, 2).join('.') || '';
      const sub = parts.slice(2).join('.') || '';
      if (!map[act]) map[act] = { mains: {} };
      if (!map[act].mains[main]) map[act].mains[main] = [];
      if (sub) map[act].mains[main].push(v); else map[act].mains[main].push(v);
    });
    return map;
  }, [variables, selected]);

  const [expandedActs, setExpandedActs] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    // Expand all by default on mount
    const init: Record<string, boolean> = {};
    Object.keys(groups).forEach(k => (init[k] = true));
    setExpandedActs(init);
  }, [groups]);

  return (
    <div style={{ width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>
          Check the selection of the variables to consider.
        </div>
        <span
          title={'Below you find the variables I would use to evaluate the condition. You can change the selection to suggest which variables are more appropriate.'}
          style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', border: '1px solid #475569', color: '#94a3b8', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}
        >
          ?
        </span>
        {onClose ? (
          <button title="Close" onClick={onClose} style={{ color: '#94a3b8', marginLeft: 6 }}>×</button>
        ) : null}
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #334155', borderRadius: 6, padding: 6 }}>
        {(!variables || variables.length === 0) && (
          <div style={{ color: '#64748b', fontSize: 12 }}>No variables referenced yet.</div>
        )}
        {Object.keys(groups).sort().map(act => (
          <div key={act} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#e5e7eb', fontWeight: 600, padding: '4px 6px', borderRadius: 6 }} onClick={() => setExpandedActs(prev => ({ ...prev, [act]: !prev[act] }))}>
              <span style={{ width: 10, display: 'inline-block', transform: expandedActs[act] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
              <span>{act}</span>
            </div>
            {expandedActs[act] && (
              <div style={{ marginLeft: 14, marginTop: 4 }}>
                {Object.keys(groups[act].mains).sort().map(mainKey => (
                  <div key={`${act}::${mainKey}`} style={{ marginBottom: 4 }}>
                    {mainKey && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e5e7eb', fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={!!(selected || []).includes(`${act}.${mainKey}`)}
                          onChange={(e) => toggle(`${act}.${mainKey}`, e.target.checked)}
                        />
                        {mainKey}
                      </label>
                    )}
                    {(groups[act].mains[mainKey] || []).filter(v => v.split('.').length >= 3).map(v => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e5e7eb', fontSize: 12, marginLeft: 14, marginTop: 2 }}>
                        <input
                          type="checkbox"
                          checked={!!(selected || []).includes(v)}
                          onChange={(e) => toggle(v, e.target.checked)}
                        />
                        {v.split('.').slice(2).join('.')}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


