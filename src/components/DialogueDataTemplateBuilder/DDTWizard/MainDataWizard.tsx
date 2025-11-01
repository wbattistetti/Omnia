import React, { useState } from 'react';
import type { SchemaNode } from './MainDataCollection';
import { Pencil, Trash2, Plus, Check, X, Link, ChevronDown, ChevronRight, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { debug } from '../../../utils/logger';
import AnimatedDots from './components/AnimatedDots';
import IconRenderer from './components/IconRenderer';
import ProgressBar from './components/ProgressBar';
import { useFieldProcessing } from './hooks/useFieldProcessing';
import { useMainEditing } from './hooks/useMainEditing';
import { useSubEditing } from './hooks/useSubEditing';
import { useConstraints } from './hooks/useConstraints';

interface MainDataWizardProps {
  node: SchemaNode;
  onChange: (node: SchemaNode) => void;
  onRemove: () => void;
  // onAddSub removed (plus now lives near the pencil)
  selected?: boolean;
  autoEdit?: boolean;
  pathPrefix?: string;
  onChangeEvent?: (e: { type: string; path: string; payload?: any }) => void;
  onRequestOpen?: () => void;
}

// 🚀 NEW: Interface for field processing state
interface FieldProcessingState {
  fieldId: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' };

const MainDataWizard: React.FC<MainDataWizardProps & {
  progressByPath?: Record<string, number>;
  fieldProcessingStates?: Record<string, FieldProcessingState>;
}> = ({ node, onChange, onRemove, progressByPath, fieldProcessingStates, selected, autoEdit, pathPrefix = '', onChangeEvent, onRequestOpen }) => {
  // Ensure open on demand (e.g., pencil click) in addition to selection
  const [forceOpen, setForceOpen] = useState(false);
  const [hoverHeader, setHoverHeader] = useState(false);
  const [hoverSubIdx, setHoverSubIdx] = useState<number | null>(null);

  // Processing state helpers (extracted to hook)
  const { getFieldProcessingState, getStatusIcon, getStatusMessage } = useFieldProcessing({
    fieldProcessingStates,
    progressByPath
  });

  // Main editing (extracted to hook)
  const {
    isEditingMain,
    labelDraft,
    setLabelDraft,
    fieldErrors,
    retryLoading,
    commitLoading,
    commitMain,
    cancelMain,
    retryField,
    startEditing: startEditingMain
  } = useMainEditing({
    node,
    autoEdit,
    onChange,
    onChangeEvent
  });

  // Sub editing (extracted to hook)
  const {
    editingSubIdx,
    subDraft,
    setSubDraft,
    startEditSub,
    commitSub,
    cancelSub,
    handleQuickAddSub
  } = useSubEditing({
    node,
    pathPrefix,
    onChange,
    onChangeEvent
  });

  // Constraints management (extracted to hook)
  const {
    hoverMainConstraints,
    setHoverMainConstraints,
    editingConstraint,
    constraintPayoffDraft,
    setConstraintPayoffDraft,
    addMainConstraint,
    addSubConstraint,
    startEditConstraint,
    commitConstraint,
    cancelConstraint,
    deleteConstraint,
  } = useConstraints({
    node,
    pathPrefix,
    onChange,
    onChangeEvent
  });

  // open ora dipende da selected
  const open = !!selected || forceOpen;

  React.useEffect(() => {
    if (!selected) setForceOpen(false);
  }, [selected]);

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
        style={{ display: 'flex', flexDirection: 'column', padding: 12, gap: 6 }}
        onMouseEnter={() => setHoverHeader(true)}
        onMouseLeave={() => setHoverHeader(false)}
      >
        {/* 📐 Riga 1: Label + Percentuale inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isEditingMain ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                <span><IconRenderer name={node.icon} size={16} /></span>
                <span style={{ fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{node.label || 'Field'}</span>

                {/* 🚀 NEW: Status display for main data */}
                {(() => {
                  const fieldId = node.label || '';
                  const state = getFieldProcessingState(fieldId);
                  const progress = progressByPath?.[fieldId] || 0;
                  const message = getStatusMessage(fieldId);

                  if (progress > 0 || state) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                        {getStatusIcon(fieldId)}
                        <span style={{ color: progress >= 100 ? '#22c55e' : '#3b82f6' }}>
                          {Math.round(progress)}%
                        </span>
                        <span style={{ color: '#64748b' }}>
                          {message}
                        </span>
                        {progress > 0 && progress < 100 && <AnimatedDots />}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              {/* RIMOSSO: Sistema vecchio che causava duplicazione percentuali */}
              {/* Action buttons */}
              {hoverHeader && (
                <>
                  <button title="Edit" onClick={() => { startEditingMain(); setForceOpen(true); onRequestOpen?.(); }} style={iconBtn}>
                    <Pencil size={16} color="#fb923c" />
                  </button>
                  <button title="Add sub data" onClick={handleQuickAddSub} style={iconBtn}>
                    <Plus size={16} color="#fb923c" />
                  </button>
                  <button title="Add constraint" onClick={addMainConstraint} style={iconBtn}>
                    <Link size={14} color="#fb923c" />
                  </button>
                  <button title="Delete" onClick={onRemove} style={iconBtn}>
                    <Trash2 size={16} color="#fb923c" />
                  </button>
                </>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 🚀 NEW: Check if this field has an error */}
              {fieldErrors[labelDraft.trim()] ? (
                // 🚀 ERROR UI: Show error state with retry button
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(e) => {
                      debug('MAIN_DATA_WIZARD', 'Label changed', { value: e.target.value });
                      setLabelDraft(e.target.value);
                    }}
                    onKeyDown={async (e) => {
                      debug('MAIN_DATA_WIZARD', 'Key pressed', { key: e.key, value: labelDraft });
                      if (e.key === 'Enter') {
                        debug('MAIN_DATA_WIZARD', 'Enter pressed, committing', { labelDraft });
                        await commitMain();
                      }
                      if (e.key === 'Escape') {
                        debug('MAIN_DATA_WIZARD', 'Escape pressed, cancelling');
                        cancelMain();
                      }
                    }}
                    placeholder="data label ..."
                    style={{
                      background: '#0f172a',
                      color: '#e2e8f0',
                      border: '1px solid #ef4444', // 🔴 RED BORDER for error
                      borderRadius: 6,
                      padding: '6px 10px',
                      minWidth: 260,
                      fontWeight: 700,
                      transition: 'all 0.3s ease-in-out',
                      boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.1)'
                    }}
                  />
                  <div
                    title={`Error: ${fieldErrors[labelDraft.trim()].error}\nRetry count: ${fieldErrors[labelDraft.trim()].retryCount}\nLast attempt: ${fieldErrors[labelDraft.trim()].lastAttempt.toLocaleTimeString()}`}
                    style={{
                      animation: 'pulse 2s infinite',
                      cursor: 'help',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <AlertTriangle
                      size={16}
                      color="#ef4444"
                    />
                  </div>
                  <button
                    onClick={() => retryField(labelDraft.trim())}
                    disabled={retryLoading[labelDraft.trim()] || false}
                    style={{
                      background: retryLoading[labelDraft.trim()] ? '#64748b' : '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 8px',
                      cursor: retryLoading[labelDraft.trim()] ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: retryLoading[labelDraft.trim()] ? 0.7 : 1,
                      transition: 'all 0.2s ease-in-out'
                    }}
                    title={`Retry field: ${labelDraft.trim()}\nAttempt: ${fieldErrors[labelDraft.trim()].retryCount + 1}`}
                  >
                    {retryLoading[labelDraft.trim()] ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        Retry ({fieldErrors[labelDraft.trim()].retryCount})
                      </>
                    )}
                  </button>
                  <button title="Cancel" onClick={cancelMain} style={iconBtn}><X size={18} color="#ef4444" /></button>
                </div>
              ) : (
                // 🚀 NORMAL UI: Standard input without error
                <>
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(e) => {
                      debug('MAIN_DATA_WIZARD', 'Label changed', { value: e.target.value });
                      setLabelDraft(e.target.value);
                    }}
                    onKeyDown={async (e) => {
                      debug('MAIN_DATA_WIZARD', 'Key pressed', { key: e.key, value: labelDraft });
                      if (e.key === 'Enter') {
                        debug('MAIN_DATA_WIZARD', 'Enter pressed, committing', { labelDraft });
                        await commitMain();
                      }
                      if (e.key === 'Escape') {
                        debug('MAIN_DATA_WIZARD', 'Escape pressed, cancelling');
                        cancelMain();
                      }
                    }}
                    placeholder="data label ..."
                    style={{
                      background: '#0f172a',
                      color: '#e2e8f0',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '6px 10px',
                      minWidth: 260,
                      fontWeight: 700,
                      transition: 'all 0.3s ease-in-out',
                      boxShadow: '0 0 0 2px rgba(51, 65, 85, 0.1)'
                    }}
                  />
                  <button
                    title="Confirm"
                    onClick={async () => {
                      debug('MAIN_DATA_WIZARD', 'Confirm clicked, committing', { labelDraft });
                      await commitMain();
                    }}
                    disabled={commitLoading}
                    style={{
                      ...iconBtn,
                      opacity: commitLoading ? 0.5 : 1,
                      cursor: commitLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {commitLoading ? (
                      <Loader2 size={18} color="#22c55e" className="animate-spin" />
                    ) : (
                      <Check size={18} color="#22c55e" />
                    )}
                  </button>
                  <button title="Cancel" onClick={cancelMain} style={iconBtn}><X size={18} color="#ef4444" /></button>
                </>
              )}
            </div>
          )}
          {/* Chevron expand/collapse - moved to end of first row */}
          <div style={{ marginLeft: 'auto' }}>
            {Array.isArray(node.subData) && node.subData.length > 0 && (
              <button
                title={open ? 'Collapse' : 'Expand'}
                onClick={() => { setForceOpen(!open); onRequestOpen?.(); }}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}
              >
                {open ? <ChevronDown size={20} color="#fb923c" /> : <ChevronRight size={20} color="#fb923c" />}
              </button>
            )}
          </div>
        </div>

        {/* 📐 Riga 2: Barra di progresso sotto, full width */}
        {(() => {
          const path = node.label;
          const val = progressByPath ? progressByPath[path] : undefined;
          if (typeof val === 'number') {
            return <ProgressBar progress={val} />;
          }
          return null;
        })()}
      </div>
      {open && (
        <div style={{ padding: 12, paddingTop: 0 }}>
          {/* Constraints for main node */}
          <div
            onMouseEnter={() => setHoverMainConstraints(true)}
            onMouseLeave={() => setHoverMainConstraints(false)}
          >
            {(Array.isArray(node.constraints) && (node.constraints as any[]).some((c: any) => (String(c?.title || '').trim().length > 0) || (String(c?.payoff || '').trim().length > 0))) && (
              <div style={{ marginBottom: 8 }}>
                {(node.constraints as any[]).filter((c: any) => (String(c?.title || '').trim().length > 0) || (String(c?.payoff || '').trim().length > 0)).map((c: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', width: '100%' }}>
                    {editingConstraint && editingConstraint.scope === 'main' && editingConstraint.idx === idx ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <input autoFocus value={constraintPayoffDraft} onChange={(e) => setConstraintPayoffDraft(e.target.value)} placeholder="describe the constraint ..." style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', flex: 1, minWidth: 0 }} />
                        <button title="Confirm" onClick={commitConstraint} disabled={(constraintPayoffDraft || '').trim().length < 5} style={{ ...iconBtn, opacity: (constraintPayoffDraft || '').trim().length < 5 ? 0.5 : 1, cursor: (constraintPayoffDraft || '').trim().length < 5 ? 'not-allowed' : 'pointer' }}>
                          <Check size={18} color={(constraintPayoffDraft || '').trim().length < 5 ? '#64748b' : '#22c55e'} />
                        </button>
                        <button title="Cancel" onClick={cancelConstraint} style={iconBtn}><X size={18} color="#ef4444" /></button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }} onMouseEnter={() => setHoverMainConstraints(true)} onMouseLeave={() => setHoverMainConstraints(false)}>
                          {(() => {
                            const mainText = (String((c as any)?.title || '').trim() || String((c as any)?.payoff || '').trim());
                            return (
                              <span style={{ fontWeight: 600, fontSize: 14, color: '#c7d2fe', whiteSpace: 'nowrap' }}>
                                {mainText}
                              </span>
                            );
                          })()}
                          {hoverMainConstraints && (
                            <>
                              <button title="Edit" onClick={() => startEditConstraint('main', idx)} style={iconBtn}><Pencil size={14} color="#fb923c" /></button>
                              <button title="Delete" onClick={() => deleteConstraint('main', idx)} style={iconBtn}><Trash2 size={14} color="#fb923c" /></button>
                            </>
                          )}
                        </div>
                        {(String((c as any)?.payoff || '').trim().length > 0) ? (
                          <div style={{ fontSize: 14, color: '#94a3b8' }}>{(c as any).payoff}</div>
                        ) : null}
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
                      placeholder="subdata label ..."
                      style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', minWidth: 280 }}
                    />
                    <button title="Confirm" onClick={() => commitSub(i)} style={iconBtn}><Check size={18} color="#22c55e" /></button>
                    <button title="Cancel" onClick={cancelSub} style={iconBtn}><X size={18} color="#ef4444" /></button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <span><IconRenderer name={s.icon} size={14} /></span>
                      <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap' }}>{s.label || 'Field'}</span>

                      {/* 🚀 NEW: Status display for sub-data */}
                      {(() => {
                        const fieldId = `${node.label}/${s.label}`;
                        const state = getFieldProcessingState(fieldId);
                        const progress = progressByPath?.[fieldId] || 0;
                        const message = getStatusMessage(fieldId);

                        if (progress > 0 || state) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px' }}>
                              {getStatusIcon(fieldId)}
                              <span style={{ color: progress >= 100 ? '#22c55e' : '#3b82f6' }}>
                                {Math.round(progress)}%
                              </span>
                              <span style={{ color: '#64748b' }}>
                                {message}
                              </span>
                              {progress > 0 && progress < 100 && <AnimatedDots />}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {hoverSubIdx === i && (
                        <>
                          <button title="Add constraint" onClick={() => addSubConstraint(i)} style={{ ...iconBtn, color: '#fb923c' }}>
                            <Link size={14} color="#fb923c" />
                          </button>
                          <button title="Edit" onClick={() => startEditSub(i, s.label || '')} style={iconBtn}>
                            <Pencil size={16} color="#fb923c" />
                          </button>
                          <button title="Delete" onClick={() => onChange({ ...node, subData: node.subData!.filter((_, x) => x !== i) })} style={iconBtn}>
                            <Trash2 size={16} color="#fb923c" />
                          </button>
                        </>
                      )}
                      <div style={{ flex: 1 }} />
                    </div>
                    {/* RIMOSSO: Sistema vecchio che causava duplicazione barre progress */}

                    {(() => {
                      const useful = (Array.isArray(s.constraints) ? s.constraints : [])
                        .filter((c: any) => (String(c?.title || '').trim().length > 0) || (String(c?.payoff || '').trim().length > 0));
                      if (useful.length === 0) return null;
                      return (
                        <div style={{ marginLeft: 20 }}>
                          {useful.map((c, j) => (
                            <div key={`c-${i}-${j}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', width: '100%' }}>
                              {editingConstraint && editingConstraint.scope === 'sub' && (editingConstraint as any).subIdx === i && editingConstraint.idx === j ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                                  <input autoFocus value={constraintPayoffDraft} onChange={(e) => setConstraintPayoffDraft(e.target.value)} placeholder="describe the constraint ..." style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', flex: 1, minWidth: 0 }} />
                                  <button title="Confirm" onClick={commitConstraint} disabled={(constraintPayoffDraft || '').trim().length < 5} style={{ ...iconBtn, opacity: (constraintPayoffDraft || '').trim().length < 5 ? 0.5 : 1, cursor: (constraintPayoffDraft || '').trim().length < 5 ? 'not-allowed' : 'pointer' }}>
                                    <Check size={18} color={(constraintPayoffDraft || '').trim().length < 5 ? '#64748b' : '#22c55e'} />
                                  </button>
                                  <button title="Cancel" onClick={cancelConstraint} style={iconBtn}><X size={18} color="#ef4444" /></button>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }} onMouseEnter={() => setHoverSubIdx(i)} onMouseLeave={() => setHoverSubIdx(curr => (curr === i ? null : curr))}>
                                    {(() => {
                                      const mainText = (String((c as any)?.title || '').trim() || String((c as any)?.payoff || '').trim());
                                      return (
                                        <span style={{ fontWeight: 600, fontSize: 14, color: '#c7d2fe', whiteSpace: 'nowrap' }}>
                                          {mainText}
                                        </span>
                                      );
                                    })()}
                                    {hoverSubIdx === i && (
                                      <>
                                        <button title="Edit" onClick={() => startEditConstraint('sub', j, i)} style={iconBtn}><Pencil size={14} color="#fb923c" /></button>
                                        <button title="Delete" onClick={() => deleteConstraint('sub', j, i)} style={iconBtn}><Trash2 size={14} color="#fb923c" /></button>
                                      </>
                                    )}
                                  </div>
                                  {(String((c as any)?.payoff || '').trim().length > 0) ? (
                                    <div style={{ fontSize: 14, color: '#94a3b8' }}>{(c as any).payoff}</div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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
