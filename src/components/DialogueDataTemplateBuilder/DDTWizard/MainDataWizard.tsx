import React, { useState } from 'react';
import type { SchemaNode } from './MainDataCollection';
import { Pencil, Trash2, Plus, Check, X, User, MapPin, Calendar, Type as TypeIcon, Mail, Phone, Hash, Globe, Home, Building, FileText, HelpCircle, Shield } from 'lucide-react';

interface MainDataWizardProps {
  node: SchemaNode;
  onChange: (node: SchemaNode) => void;
  onRemove: () => void;
  onAddSub: () => void;
  selected?: boolean;
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' };

const MainDataWizard: React.FC<MainDataWizardProps & { progressByPath?: Record<string, number> }> = ({ node, onChange, onRemove, onAddSub, progressByPath, selected }) => {
  // const [open, setOpen] = useState(false); // RIMOSSO
  const [isEditingMain, setIsEditingMain] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.label || '');
  const [hoverHeader, setHoverHeader] = useState(false);
  const [editingSubIdx, setEditingSubIdx] = useState<number | null>(null);
  const [hoverSubIdx, setHoverSubIdx] = useState<number | null>(null);
  const [subDraft, setSubDraft] = useState<string>('');
  const [hoverMainConstraints, setHoverMainConstraints] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<
    | { scope: 'main'; idx: number }
    | { scope: 'sub'; subIdx: number; idx: number }
    | null
  >(null);
  const [constraintTitleDraft, setConstraintTitleDraft] = useState('');
  const [constraintPayoffDraft, setConstraintPayoffDraft] = useState('');

  const renderIcon = (name?: string, size: number = 16) => {
    const color = '#fb923c';
    switch ((name || '').trim()) {
      case 'User': return <User size={size} color={color} />;
      case 'MapPin': return <MapPin size={size} color={color} />;
      case 'Calendar': return <Calendar size={size} color={color} />;
      case 'Type': return <TypeIcon size={size} color={color} />;
      case 'Mail': return <Mail size={size} color={color} />;
      case 'Phone': return <Phone size={size} color={color} />;
      case 'Hash': return <Hash size={size} color={color} />;
      case 'Globe': return <Globe size={size} color={color} />;
      case 'Home': return <Home size={size} color={color} />;
      case 'Building': return <Building size={size} color={color} />;
      case 'HelpCircle': return <HelpCircle size={size} color={color} />;
      case 'FileText':
      default:
        return <FileText size={size} color={color} />;
    }
  };

  const commitMain = () => {
    setIsEditingMain(false);
    if ((node.label || '') !== labelDraft) onChange({ ...node, label: labelDraft });
  };

  const cancelMain = () => {
    setIsEditingMain(false);
    setLabelDraft(node.label || '');
  };

  const startEditSub = (idx: number, current: string) => {
    setEditingSubIdx(idx);
    setSubDraft(current || '');
  };

  const commitSub = (idx: number) => {
    const next = { ...node, subData: Array.isArray(node.subData) ? node.subData.slice() : [] } as SchemaNode;
    next.subData![idx] = { ...(next.subData![idx] || { label: '' }), label: subDraft } as SchemaNode;
    onChange(next);
    setEditingSubIdx(null);
    setSubDraft('');
  };

  const cancelSub = () => {
    setEditingSubIdx(null);
    setSubDraft('');
  };

  const ensureMainConstraints = () => Array.isArray(node.constraints) ? node.constraints.slice() : [];
  const ensureSubConstraints = (subIdx: number) => {
    const sub = (node.subData || [])[subIdx];
    const arr = sub && Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
    return arr;
  };

  const addMainConstraint = () => {
    const next = { ...node } as SchemaNode;
    const list = ensureMainConstraints();
    list.push({ kind: 'length', title: 'Rule', payoff: '' } as any);
    next.constraints = list;
    onChange(next);
  };

  const addSubConstraint = (subIdx: number) => {
    const next = { ...node, subData: Array.isArray(node.subData) ? node.subData.slice() : [] } as SchemaNode;
    const sub = { ...(next.subData?.[subIdx] || {}) } as any;
    const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
    list.push({ kind: 'length', title: 'Rule', payoff: '' } as any);
    sub.constraints = list;
    (next.subData as any)[subIdx] = sub;
    onChange(next);
  };

  const startEditConstraint = (scope: 'main' | 'sub', idx: number, subIdx?: number) => {
    if (scope === 'main') {
      const c = ensureMainConstraints()[idx];
      setConstraintTitleDraft(c?.title || '');
      setConstraintPayoffDraft(c?.payoff || '');
      setEditingConstraint({ scope: 'main', idx });
    } else if (typeof subIdx === 'number') {
      const c = ensureSubConstraints(subIdx)[idx];
      setConstraintTitleDraft(c?.title || '');
      setConstraintPayoffDraft(c?.payoff || '');
      setEditingConstraint({ scope: 'sub', subIdx, idx });
    }
  };

  const commitConstraint = () => {
    if (!editingConstraint) return;
    if (editingConstraint.scope === 'main') {
      const list = ensureMainConstraints();
      if (list[editingConstraint.idx]) {
        list[editingConstraint.idx] = { ...list[editingConstraint.idx], title: constraintTitleDraft, payoff: constraintPayoffDraft } as any;
        onChange({ ...node, constraints: list });
      }
    } else {
      const { subIdx, idx } = editingConstraint as any;
      const next = { ...node, subData: Array.isArray(node.subData) ? node.subData.slice() : [] } as SchemaNode;
      const sub = { ...(next.subData?.[subIdx] || {}) } as any;
      const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
      if (list[idx]) list[idx] = { ...list[idx], title: constraintTitleDraft, payoff: constraintPayoffDraft } as any;
      sub.constraints = list;
      (next.subData as any)[subIdx] = sub;
      onChange(next);
    }
    setEditingConstraint(null);
    setConstraintTitleDraft('');
    setConstraintPayoffDraft('');
  };

  const cancelConstraint = () => {
    setEditingConstraint(null);
    setConstraintTitleDraft('');
    setConstraintPayoffDraft('');
  };

  const deleteConstraint = (scope: 'main' | 'sub', idx: number, subIdx?: number) => {
    if (scope === 'main') {
      const list = ensureMainConstraints();
      const nextList = list.filter((_, i) => i !== idx);
      onChange({ ...node, constraints: nextList });
    } else if (typeof subIdx === 'number') {
      const next = { ...node, subData: Array.isArray(node.subData) ? node.subData.slice() : [] } as SchemaNode;
      const sub = { ...(next.subData?.[subIdx] || {}) } as any;
      const list = Array.isArray(sub.constraints) ? sub.constraints.slice() : [];
      sub.constraints = list.filter((_: any, i: number) => i !== idx);
      (next.subData as any)[subIdx] = sub;
      onChange(next);
    }
  };

  // open ora dipende da selected
  const open = !!selected;

  return (
    <div
      style={{
        border: selected ? '4px solid #fff' : '1px solid #7c2d12',
        borderRadius: 10,
        marginBottom: 10,
        background: '#0b1220',
        boxSizing: 'border-box',
        transition: 'border 0.15s',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', padding: 12 }}
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          {!isEditingMain ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{renderIcon(node.icon, 16)}</span>
              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{node.label || 'Field'}</span>
              {hoverHeader && (
                <>
                  <button title="Edit" onClick={() => { setIsEditingMain(true); setLabelDraft(node.label || ''); }} style={iconBtn}>
                    <Pencil size={16} color="#fb923c" />
                  </button>
                  <button title="Delete" onClick={onRemove} style={iconBtn}>
                    <Trash2 size={16} color="#fb923c" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitMain(); if (e.key === 'Escape') cancelMain(); }}
                style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', minWidth: 260, fontWeight: 700 }}
              />
              <button title="Confirm" onClick={commitMain} style={iconBtn}><Check size={18} color="#22c55e" /></button>
              <button title="Cancel" onClick={cancelMain} style={iconBtn}><X size={18} color="#ef4444" /></button>
            </div>
          )}
        </div>
        {/* Right-side actions: Add Data (hover) + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hoverHeader && !isEditingMain && (
            <button title="Add Data" onClick={onAddSub} style={{ ...iconBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} color="#fb923c" />
              <span style={{ color: '#fb923c' }}>Add Data</span>
            </button>
          )}
          {/* Il pulsante di espansione ora non serve più, tolto */}
        </div>
      </div>
      {/* main progress bar */}
      {(() => {
        const path = node.label;
        const val = progressByPath ? progressByPath[path] : undefined;
        if (typeof val === 'number') {
          return (
            <div style={{ height: 4, background: '#1f2937', borderRadius: 9999, overflow: 'hidden', margin: '0 12px' }}>
              <div style={{ width: `${Math.round(val * 100)}%`, height: '100%', background: '#fb923c' }} />
            </div>
          );
        }
        return null;
      })()}
      {open && (
        <div style={{ padding: 12, paddingTop: 0 }}>
          {/* Constraints for main node */}
          <div
            onMouseEnter={() => setHoverMainConstraints(true)}
            onMouseLeave={() => setHoverMainConstraints(false)}
          >
            {hoverMainConstraints && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button title="Add constraint" onClick={addMainConstraint} style={{ ...iconBtn, color: '#fb923c' }}>+ Add constraint</button>
              </div>
            )}
            {Array.isArray(node.constraints) && node.constraints.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {node.constraints.map((c, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0' }}>
                    {editingConstraint && editingConstraint.scope === 'main' && editingConstraint.idx === idx ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input value={constraintTitleDraft} onChange={(e) => setConstraintTitleDraft(e.target.value)} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', width: 160 }} />
                        <input value={constraintPayoffDraft} onChange={(e) => setConstraintPayoffDraft(e.target.value)} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', flex: 1 }} />
                        <button title="Confirm" onClick={commitConstraint} style={iconBtn}><Check size={18} color="#22c55e" /></button>
                        <button title="Cancel" onClick={cancelConstraint} style={iconBtn}><X size={18} color="#ef4444" /></button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Shield size={16} color="#fb923c" fill="#fb923c" />
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#c7d2fe' }}>{c.title}</span>
                          <button title="Edit" onClick={() => startEditConstraint('main', idx)} style={iconBtn}><Pencil size={14} color="#fb923c" /></button>
                          <button title="Delete" onClick={() => deleteConstraint('main', idx)} style={iconBtn}><Trash2 size={14} color="#fb923c" /></button>
                        </div>
                        <div style={{ fontSize: 14, color: '#94a3b8' }}>{c.payoff}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {Array.isArray(node.subData) && node.subData.length > 0 ? (
            node.subData.map((s, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}
                onMouseEnter={() => setHoverSubIdx(i)}
                onMouseLeave={() => setHoverSubIdx(curr => (curr === i ? null : curr))}
              >
                {editingSubIdx === i ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      autoFocus
                      value={subDraft}
                      onChange={(e) => setSubDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitSub(i); if (e.key === 'Escape') cancelSub(); }}
                      style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', minWidth: 280 }}
                    />
                    <button title="Confirm" onClick={() => commitSub(i)} style={iconBtn}><Check size={18} color="#22c55e" /></button>
                    <button title="Cancel" onClick={cancelSub} style={iconBtn}><X size={18} color="#ef4444" /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{renderIcon(s.icon, 14)}</span>
                      <span style={{ color: '#e2e8f0' }}>{s.label || 'Field'}</span>
                      {hoverSubIdx === i && (
                        <button title="Add constraint" onClick={() => addSubConstraint(i)} style={{ ...iconBtn, color: '#fb923c', marginLeft: 8 }}>+ Add constraint</button>
                      )}
                      {hoverSubIdx === i && (
                        <>
                          <button title="Edit" onClick={() => startEditSub(i, s.label || '')} style={iconBtn}>
                            <Pencil size={16} color="#fb923c" />
                          </button>
                          <button title="Delete" onClick={() => onChange({ ...node, subData: node.subData!.filter((_, x) => x !== i) })} style={iconBtn}>
                            <Trash2 size={16} color="#fb923c" />
                          </button>
                        </>
                      )}
                    </div>
                    {/* sub progress bar */}
                    {(() => {
                      const path = `${node.label}/${s.label}`;
                      const val = progressByPath ? progressByPath[path] : undefined;
                      if (typeof val === 'number') {
                        return (
                          <div style={{ height: 3, background: '#1f2937', borderRadius: 9999, overflow: 'hidden', marginLeft: 22, marginTop: 4 }}>
                            <div style={{ width: `${Math.round(val * 100)}%`, height: '100%', background: '#fb923c' }} />
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {Array.isArray(s.constraints) && s.constraints.length > 0 && (
                      <div style={{ marginLeft: 20 }}>
                        {s.constraints.map((c, j) => (
                          <div key={`c-${i}-${j}`} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0' }}>
                            {editingConstraint && editingConstraint.scope === 'sub' && (editingConstraint as any).subIdx === i && editingConstraint.idx === j ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input value={constraintTitleDraft} onChange={(e) => setConstraintTitleDraft(e.target.value)} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', width: 160 }} />
                                <input value={constraintPayoffDraft} onChange={(e) => setConstraintPayoffDraft(e.target.value)} style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', flex: 1 }} />
                                <button title="Confirm" onClick={commitConstraint} style={iconBtn}><Check size={18} color="#22c55e" /></button>
                                <button title="Cancel" onClick={cancelConstraint} style={iconBtn}><X size={18} color="#ef4444" /></button>
                              </div>
                            ) : (
                              <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Shield size={15} color="#fb923c" fill="#fb923c" />
                              <span style={{ fontWeight: 600, fontSize: 14, color: '#c7d2fe' }}>{c.title}</span>
                                  <button title="Edit" onClick={() => startEditConstraint('sub', j, i)} style={iconBtn}><Pencil size={14} color="#fb923c" /></button>
                                  <button title="Delete" onClick={() => deleteConstraint('sub', j, i)} style={iconBtn}><Trash2 size={14} color="#fb923c" /></button>
                                </div>
                            <div style={{ fontSize: 14, color: '#94a3b8' }}>{c.payoff}</div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.8, fontStyle: 'italic', marginTop: 6 }}>No sub fields yet.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MainDataWizard;
