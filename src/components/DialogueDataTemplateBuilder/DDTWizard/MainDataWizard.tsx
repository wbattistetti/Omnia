import React, { useState } from 'react';
import type { SchemaNode } from './MainDataCollection';
import { Pencil, Trash2, ChevronDown, ChevronRight, Plus, Check, X, User, MapPin, Calendar, Type as TypeIcon, Mail, Phone, Hash, Globe, Home, Building, FileText, HelpCircle } from 'lucide-react';

interface MainDataWizardProps {
  node: SchemaNode;
  onChange: (node: SchemaNode) => void;
  onRemove: () => void;
  onAddSub: () => void;
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' };

const MainDataWizard: React.FC<MainDataWizardProps> = ({ node, onChange, onRemove, onAddSub }) => {
  const [open, setOpen] = useState(false);
  const [isEditingMain, setIsEditingMain] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.label || '');
  const [hoverHeader, setHoverHeader] = useState(false);
  const [editingSubIdx, setEditingSubIdx] = useState<number | null>(null);
  const [hoverSubIdx, setHoverSubIdx] = useState<number | null>(null);
  const [subDraft, setSubDraft] = useState<string>('');

  const renderIcon = (name?: string, size: number = 16) => {
    const color = '#a78bfa';
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

  return (
    <div style={{ border: '1px solid #4c1d95', borderRadius: 10, marginBottom: 10, background: '#0b1220' }}>
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
                    <Pencil size={16} color="#a78bfa" />
                  </button>
                  <button title="Delete" onClick={onRemove} style={iconBtn}>
                    <Trash2 size={16} color="#a78bfa" />
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
              <Plus size={16} color="#a78bfa" />
              <span style={{ color: '#a78bfa' }}>Add Data</span>
            </button>
          )}
          <button onClick={() => setOpen(o => !o)} style={iconBtn}>
            {open ? <ChevronDown size={20} color="#a78bfa" /> : <ChevronRight size={20} color="#a78bfa" />}
          </button>
        </div>
      </div>
      {open && (
        <div style={{ padding: 12, paddingTop: 0 }}>
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
                  <>
                    <span>{renderIcon(s.icon, 14)}</span>
                    <span style={{ color: '#e2e8f0' }}>{s.label || 'Field'}</span>
                    {hoverSubIdx === i && (
                      <>
                        <button title="Edit" onClick={() => startEditSub(i, s.label || '')} style={iconBtn}>
                          <Pencil size={16} color="#a78bfa" />
                        </button>
                        <button title="Delete" onClick={() => onChange({ ...node, subData: node.subData!.filter((_, x) => x !== i) })} style={iconBtn}>
                          <Trash2 size={16} color="#a78bfa" />
                        </button>
                      </>
                    )}
                  </>
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
