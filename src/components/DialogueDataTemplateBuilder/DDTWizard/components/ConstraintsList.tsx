import React from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import type { SchemaNode } from '../dataCollection';

interface ConstraintsListProps {
  constraints: any[];
  scope: 'main' | 'sub';
  subIdx?: number;
  editingConstraint: { scope: 'main' | 'sub'; idx: number; subIdx?: number } | null;
  constraintPayoffDraft: string;
  setConstraintPayoffDraft: (value: string) => void;
  startEditConstraint: (scope: 'main' | 'sub', idx: number, subIdx?: number) => void;
  commitConstraint: () => void;
  cancelConstraint: () => void;
  deleteConstraint: (scope: 'main' | 'sub', idx: number, subIdx?: number) => void;
  hoverSubIdx?: number | null;
  setHoverSubIdx?: (value: number | null | ((prev: number | null) => number | null)) => void;
  hoverMainConstraints?: boolean;
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' };

export default function ConstraintsList({
  constraints,
  scope,
  subIdx,
  editingConstraint,
  constraintPayoffDraft,
  setConstraintPayoffDraft,
  startEditConstraint,
  commitConstraint,
  cancelConstraint,
  deleteConstraint,
  hoverSubIdx,
  setHoverSubIdx,
}: ConstraintsListProps) {
  const useful = constraints.filter((c: any) =>
    (String(c?.title || '').trim().length > 0) || (String(c?.payoff || '').trim().length > 0)
  );

  if (useful.length === 0) return null;

  return (
    <div style={scope === 'sub' ? { marginLeft: 20 } : undefined}>
      {useful.map((c, idx) => {
        const isEditing = editingConstraint &&
          editingConstraint.scope === scope &&
          editingConstraint.idx === idx &&
          (scope === 'main' || editingConstraint.subIdx === subIdx);

        return (
          <div key={`c-${scope}-${subIdx ?? 'main'}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', width: '100%' }}>
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <input
                  autoFocus
                  value={constraintPayoffDraft}
                  onChange={(e) => setConstraintPayoffDraft(e.target.value)}
                  placeholder="describe the constraint ..."
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '4px 8px',
                    flex: 1,
                    minWidth: 0
                  }}
                />
                <button
                  title="Confirm"
                  onClick={commitConstraint}
                  disabled={(constraintPayoffDraft || '').trim().length < 5}
                  style={{
                    ...iconBtn,
                    opacity: (constraintPayoffDraft || '').trim().length < 5 ? 0.5 : 1,
                    cursor: (constraintPayoffDraft || '').trim().length < 5 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Check size={18} color={(constraintPayoffDraft || '').trim().length < 5 ? '#64748b' : '#22c55e'} />
                </button>
                <button title="Cancel" onClick={cancelConstraint} style={iconBtn}>
                  <X size={18} color="#ef4444" />
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
                  onMouseEnter={scope === 'sub' && subIdx !== undefined && setHoverSubIdx ? () => setHoverSubIdx!(subIdx) : undefined}
                  onMouseLeave={scope === 'sub' && subIdx !== undefined && setHoverSubIdx ? () => setHoverSubIdx!(curr => (curr === subIdx ? null : curr)) : undefined}
                >
                  {(() => {
                    const mainText = (String((c as any)?.title || '').trim() || String((c as any)?.payoff || '').trim());
                    return (
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#c7d2fe', whiteSpace: 'nowrap' }}>
                        {mainText}
                      </span>
                    );
                  })()}
                  {(scope === 'main' ? hoverMainConstraints : (hoverSubIdx === subIdx)) && (
                    <>
                      <button
                        title="Edit"
                        onClick={() => startEditConstraint(scope, idx, subIdx)}
                        style={iconBtn}
                      >
                        <Pencil size={14} color="#fb923c" />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => deleteConstraint(scope, idx, subIdx)}
                        style={iconBtn}
                      >
                        <Trash2 size={14} color="#fb923c" />
                      </button>
                    </>
                  )}
                </div>
                {(String((c as any)?.payoff || '').trim().length > 0) ? (
                  <div style={{ fontSize: 14, color: '#94a3b8' }}>{(c as any).payoff}</div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

