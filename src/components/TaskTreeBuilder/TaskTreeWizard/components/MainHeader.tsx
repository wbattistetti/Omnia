import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Link, Check, X, ChevronDown, ChevronRight, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import IconRenderer from './IconRenderer';
import FieldStatusDisplay from './FieldStatusDisplay';
import type { SchemaNode } from '../dataCollection';
import type { FieldErrorState } from '../hooks/useMainEditing';
import type { FieldProcessingState } from '../hooks/useFieldProcessing';
import { useFontContext } from '../../../../context/FontContext';

interface MainHeaderProps {
  node: SchemaNode;
  isEditingMain: boolean;
  labelDraft: string;
  setLabelDraft: (value: string) => void;
  fieldErrors: Record<string, FieldErrorState>;
  retryLoading: Record<string, boolean>;
  commitLoading: boolean;
  commitMain: () => Promise<void>;
  cancelMain: () => void;
  retryField: (fieldId: string) => void;
  startEditingMain: () => void;
  handleQuickAddSub: () => void;
  addMainConstraint: () => void;
  onRemove: () => void;
  hoverHeader: boolean;
  setHoverHeader: (value: boolean) => void;
  setForceOpen: (value: boolean) => void;
  onRequestOpen?: () => void;
  open: boolean;
  progressByPath?: Record<string, number>;
  getFieldProcessingState: (fieldId: string) => FieldProcessingState | null;
  getStatusIcon: (fieldId: string) => React.ReactNode;
  getStatusMessage: (fieldId: string) => string;
  onRetryField?: (fieldId: string) => void;
  onCreateManually?: () => void;
  compact?: boolean; // ✅ Modalità compatta
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' };

export default function MainHeader({
  node,
  isEditingMain,
  labelDraft,
  setLabelDraft,
  fieldErrors,
  retryLoading,
  commitLoading,
  commitMain,
  cancelMain,
  retryField,
  startEditingMain,
  handleQuickAddSub,
  addMainConstraint,
  onRemove,
  hoverHeader,
  setHoverHeader,
  setForceOpen,
  onRequestOpen,
  open,
  progressByPath,
  getFieldProcessingState,
  getStatusIcon,
  getStatusMessage,
  onRetryField,
  onCreateManually,
  compact = false,
}: MainHeaderProps) {
  const { combinedClass } = useFontContext();
  const labelRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);

  // Measure label width more robustly - always measure when labelRef is available
  useEffect(() => {
    if (labelRef.current && !isEditingMain) {
      const rect = labelRef.current.getBoundingClientRect();
      const width = rect.width;
      setLabelWidth(width);
    }
  }, [node.label, isEditingMain]);

  // Use ResizeObserver for dynamic updates
  useEffect(() => {
    if (!labelRef.current || isEditingMain) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setLabelWidth(width);
      }
    });

    observer.observe(labelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [isEditingMain]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: compact ? 4 : 12,
        gap: compact ? 2 : 6,
        minWidth: labelWidth ? `fit-content` : undefined
      }}
      onMouseEnter={() => setHoverHeader(true)}
      onMouseLeave={() => setHoverHeader(false)}
    >
      {/* 📐 Riga 1: Label + Percentuale inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 10, minWidth: 0 }}>
        {!isEditingMain ? (
          <>
            <div ref={labelRef} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ flexShrink: 0 }}><IconRenderer name={node.icon} size={16} /></span>
                <span className={combinedClass} style={{ fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{node.label || 'Field'}</span>

                {/* 🚀 NEW: Status display for main data - Row 1 only (icon + percentage + buttons) */}
                {(() => {
                  const fieldId = node.label || '';
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
                      className={combinedClass}
                      compact={false}
                      showPayoff={true}
                    />
                  );
                })()}
              </div>
            </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {/* 🚀 NEW: Check if this field has an error */}
            {fieldErrors[labelDraft.trim()] ? (
              // 🚀 ERROR UI: Show error state with retry button
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <input
                  autoFocus
                  value={labelDraft}
                  onChange={(e) => {
                    setLabelDraft(e.target.value);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await commitMain();
                    }
                    if (e.key === 'Escape') {
                      cancelMain();
                    }
                  }}
                  placeholder="data label ..."
                  className={combinedClass}
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    border: '1px solid #ef4444', // 🔴 RED BORDER for error
                    borderRadius: 6,
                    padding: '6px 10px',
                    width: labelWidth ? `${labelWidth}px` : undefined,
                    minWidth: labelWidth ? `${labelWidth}px` : 260,
                    flexShrink: 0,
                    fontWeight: 700,
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.1)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxSizing: 'border-box'
                  }}
                  ref={(inputEl) => {
                    // Input ref (debug disabled)
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
                  className={combinedClass}
                  style={{
                    background: retryLoading[labelDraft.trim()] ? '#64748b' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    cursor: retryLoading[labelDraft.trim()] ? 'not-allowed' : 'pointer',
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
                    setLabelDraft(e.target.value);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await commitMain();
                    }
                    if (e.key === 'Escape') {
                      cancelMain();
                    }
                  }}
                  placeholder="data label ..."
                  className={combinedClass}
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '6px 10px',
                    width: labelWidth ? `${labelWidth}px` : undefined,
                    minWidth: labelWidth ? `${labelWidth}px` : 260,
                    flexShrink: 0,
                    fontWeight: 700,
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: '0 0 0 2px rgba(51, 65, 85, 0.1)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxSizing: 'border-box'
                  }}
                  ref={(inputEl) => {
                    // Input ref (debug disabled)
                  }}
                />
                <button
                  title="Confirm"
                  onClick={async () => {
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
          {((node as any).subTasks && Array.isArray((node as any).subTasks) && (node as any).subTasks.length > 0) || (Array.isArray(node.subData) && node.subData.length > 0) && (
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
    </div>
  );
}

