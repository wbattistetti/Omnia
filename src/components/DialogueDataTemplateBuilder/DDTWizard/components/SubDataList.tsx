import React from 'react';
import { Pencil, Trash2, Link, Check, X } from 'lucide-react';
import IconRenderer from './IconRenderer';
import FieldStatusDisplay from './FieldStatusDisplay';
import ConstraintsList from './ConstraintsList';
import type { SchemaNode } from '../dataCollection';
import type { FieldProcessingState } from '../hooks/useFieldProcessing';

interface SubDataListProps {
  node: SchemaNode;
  editingSubIdx: number | null;
  subDraft: string;
  setSubDraft: (value: string) => void;
  startEditSub: (idx: number, currentLabel: string) => void;
  commitSub: (idx: number) => void;
  cancelSub: () => void;
  onChange: (node: SchemaNode) => void;
  hoverSubIdx: number | null;
  setHoverSubIdx: (value: number | null | ((prev: number | null) => number | null)) => void;
  addSubConstraint: (subIdx: number) => void;
  editingConstraint: { scope: 'main' | 'sub'; idx: number; subIdx?: number } | null;
  constraintPayoffDraft: string;
  setConstraintPayoffDraft: (value: string) => void;
  startEditConstraint: (scope: 'main' | 'sub', idx: number, subIdx?: number) => void;
  commitConstraint: () => void;
  cancelConstraint: () => void;
  deleteConstraint: (scope: 'main' | 'sub', idx: number, subIdx?: number) => void;
  progressByPath?: Record<string, number>;
  getFieldProcessingState: (fieldId: string) => FieldProcessingState | null;
  getStatusIcon: (fieldId: string) => React.ReactNode;
  getStatusMessage: (fieldId: string) => string;
  onRetryField?: (fieldId: string) => void;
  onCreateManually?: () => void;
  compact?: boolean; // ✅ Modalità compatta
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' };

export default function SubDataList({
  node,
  editingSubIdx,
  subDraft,
  setSubDraft,
  startEditSub,
  commitSub,
  cancelSub,
  onChange,
  hoverSubIdx,
  setHoverSubIdx,
  addSubConstraint,
  editingConstraint,
  constraintPayoffDraft,
  setConstraintPayoffDraft,
  startEditConstraint,
  commitConstraint,
  cancelConstraint,
  deleteConstraint,
  progressByPath,
  getFieldProcessingState,
  getStatusIcon,
  getStatusMessage,
  onRetryField,
  onCreateManually,
  compact = false,
}: SubDataListProps) {
  if (!Array.isArray(node.subData) || node.subData.length === 0) {
    return <div style={{ opacity: 0.8, fontStyle: 'italic', marginTop: 6 }}>No sub fields yet.</div>;
  }

  return (
    <>
      {node.subData.map((s, i) => (
        <div
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 8, marginTop: compact ? 2 : 8 }}
          onMouseEnter={() => setHoverSubIdx(i)}
          onMouseLeave={() => setHoverSubIdx(curr => (curr === i ? null : curr))}
        >
          {editingSubIdx === i ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                autoFocus
                value={subDraft}
                onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSub(i);
                  if (e.key === 'Escape') cancelSub();
                }}
                placeholder="subdata label ..."
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '6px 10px',
                  minWidth: 280
                }}
              />
              <button title="Confirm" onClick={() => commitSub(i)} style={iconBtn}>
                <Check size={18} color="#22c55e" />
              </button>
              <button title="Cancel" onClick={cancelSub} style={iconBtn}>
                <X size={18} color="#ef4444" />
              </button>
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
                  const hasError = state?.status === 'error';

                  return (
                    <FieldStatusDisplay
                      fieldId={fieldId}
                      state={state}
                      progress={progress}
                      message={message}
                      hasError={hasError}
                      onRetryField={onRetryField}
                      onCreateManually={onCreateManually}
                      getStatusIcon={getStatusIcon}
                      compact={true}
                      showPayoff={true}
                    />
                  );
                })()}
                {hoverSubIdx === i && (
                  <>
                    <button
                      title="Add constraint"
                      onClick={() => addSubConstraint(i)}
                      style={{ ...iconBtn, color: '#fb923c' }}
                    >
                      <Link size={14} color="#fb923c" />
                    </button>
                    <button
                      title="Edit"
                      onClick={() => startEditSub(i, s.label || '')}
                      style={iconBtn}
                    >
                      <Pencil size={16} color="#fb923c" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => onChange({ ...node, subData: node.subData!.filter((_, x) => x !== i) })}
                      style={iconBtn}
                    >
                      <Trash2 size={16} color="#fb923c" />
                    </button>
                  </>
                )}
                <div style={{ flex: 1 }} />
              </div>

              {/* Constraints for sub-data */}
              {s.constraints && (
                <ConstraintsList
                  constraints={Array.isArray(s.constraints) ? s.constraints : []}
                  scope="sub"
                  subIdx={i}
                  editingConstraint={editingConstraint}
                  constraintPayoffDraft={constraintPayoffDraft}
                  setConstraintPayoffDraft={setConstraintPayoffDraft}
                  startEditConstraint={startEditConstraint}
                  commitConstraint={commitConstraint}
                  cancelConstraint={cancelConstraint}
                  deleteConstraint={deleteConstraint}
                  hoverSubIdx={hoverSubIdx}
                  setHoverSubIdx={setHoverSubIdx}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

