import React from 'react';
import { SourceItem } from './SourceList';
import { EndpointCard } from './EndpointCards';

interface SourceAccordionProps {
  sources: SourceItem[];
  bySource: Record<string, EndpointCard[]>;
  initiallyOpenId?: string;
}

export default function SourceAccordion({ sources, bySource, initiallyOpenId }: SourceAccordionProps) {
  const [editingAlias, setEditingAlias] = React.useState<Record<string, boolean>>({});
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {sources.map(src => (
        <details key={src.id} open={src.id === initiallyOpenId} style={{ border: '1px solid #333', borderRadius: 8, padding: 6 }}>
          <summary style={{ cursor: 'pointer', padding: 6, color: '#e5e7eb', fontWeight: 700 }}>
            {src.name} <span style={{ color: '#9ca3af', fontWeight: 400 }}>• {src.type.toUpperCase()} • {src.endpoints} endpoint</span>
          </summary>
          <div style={{ padding: '6px 8px' }}>
            {(bySource[src.id] || []).map(ep => (
              <details key={ep.id} style={{ border: '1px solid #444', borderRadius: 8, padding: 6, marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer', padding: 6 }}>
                  {ep.purpose ? (
                    <div style={{ color: '#e5e7eb' }}>{ep.purpose}</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555' }}>{ep.method.toUpperCase()}</span>
                      <strong>{ep.path}</strong>
                    </div>
                  )}
                </summary>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555' }}>{ep.method.toUpperCase()}</span>
                    <strong>{ep.path}</strong>
                  </div>
                  {ep.inputs.map((p, i) => {
                    const paramKey = `${ep.id}:${i}`;
                    const defaultAlias = ((p as any).alias || (p.name || '').replace(/[_-]+/g, ' ').trim());
                    const isEditing = !!editingAlias[paramKey];
                    return (
                    <div key={i} title={p.desc || `${p.location} ${p.type}`} style={{
                      display: 'flex', alignItems: 'center', gap: 6, color: '#e5e7eb', fontSize: 12
                    }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                        background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.6)', color: '#93c5fd'
                      }}>{p.name}</span>
                      {!isEditing && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 10, border: '1px solid #6b7280', background: 'rgba(107,114,128,0.15)', color: '#d1d5db', cursor: 'text'
                        }} onClick={(e) => { e.stopPropagation(); (p as any).__prevAlias = defaultAlias; setEditingAlias(prev => ({ ...prev, [paramKey]: true })); }}>
                          <span style={{ opacity: 0.8 }}>→</span>
                          <span>{defaultAlias}</span>
                        </span>
                      )}
                      {isEditing && (
                        <>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 10, border: '1px solid #6b7280', background: 'rgba(107,114,128,0.15)', color: '#d1d5db'
                          }}>
                            <span style={{ opacity: 0.8 }}>→</span>
                            <input
                              defaultValue={defaultAlias}
                              size={Math.max(6, defaultAlias.length)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (p as any).alias = (e.currentTarget as HTMLInputElement).value.trim();
                                  setEditingAlias(prev => ({ ...prev, [paramKey]: false }));
                                }
                                if (e.key === 'Escape') {
                                  const prevAlias = (p as any).__prevAlias || defaultAlias;
                                  (p as any).alias = prevAlias;
                                  (e.currentTarget as HTMLInputElement).value = prevAlias;
                                  (e.currentTarget as HTMLInputElement).size = Math.max(6, prevAlias.length);
                                  setEditingAlias(prev => ({ ...prev, [paramKey]: false }));
                                }
                              }}
                              onChange={(e) => {
                                (p as any).alias = e.target.value;
                                (e.currentTarget as HTMLInputElement).size = Math.max(6, e.currentTarget.value.length);
                              }}
                              style={{
                                background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', fontSize: 12
                              }}
                            />
                          </span>
                          <button title="Conferma (Enter)" style={{
                            border: 'none', background: 'transparent', color: '#a7f3d0', cursor: 'pointer', padding: '0 4px'
                          }} onClick={(e) => {
                            e.stopPropagation();
                            setEditingAlias(prev => ({ ...prev, [paramKey]: false }));
                          }}>✓</button>
                          <button title="Annulla (Esc)" style={{
                            border: 'none', background: 'transparent', color: '#fca5a5', cursor: 'pointer', padding: '0 4px'
                          }} onClick={(e) => {
                            e.stopPropagation();
                            (p as any).alias = (p as any).__prevAlias || defaultAlias;
                            setEditingAlias(prev => ({ ...prev, [paramKey]: false }));
                          }}>x</button>
                        </>
                      )}
                      {Array.isArray((p as any).enumValues) && (p as any).enumValues.length > 0 && (
                        <button title="Mostra valori possibili" style={{
                          marginLeft: 4, padding: '1px 6px', borderRadius: 10, border: '1px solid #3b82f6', background: 'rgba(59,130,246,0.1)', color: '#93c5fd', cursor: 'pointer'
                        }} onClick={(e) => {
                          e.stopPropagation();
                          alert(`Valori possibili: ${(p as any).enumValues.join(', ')}`);
                        }}>Valori</button>
                      )}
                      {p.domain || p.example ? <span style={{ color: '#9ca3af' }}>({p.domain || p.example})</span> : null}
                    </div>
                  );})}
                  {ep.outputs.map((o, i) => (
                    <div key={`o-${i}`} title={o.desc} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#e5e7eb', fontSize: 12 }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                        background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399'
                      }}>status {o.status}</span>
                      {(o.mainFields || []).length > 0 ? <span style={{ color: '#9ca3af' }}>({(o.mainFields || []).join(', ')})</span> : null}
                    </div>
                  ))}
                </div>
                {ep.gaps && ep.gaps.length > 0 && (
                  <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 12 }}>Gaps: {ep.gaps.join('; ')}</div>
                )}
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}


