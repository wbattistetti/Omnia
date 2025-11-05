import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Link, Check, X, ChevronDown, ChevronRight, AlertTriangle, Loader2, RefreshCw, FileEdit } from 'lucide-react';
import IconRenderer from './IconRenderer';
import AnimatedDots from './AnimatedDots';
import type { SchemaNode } from '../MainDataCollection';
import type { FieldErrorState } from '../hooks/useMainEditing';
import type { FieldProcessingState } from '../hooks/useFieldProcessing';

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
}: MainHeaderProps) {
  console.log('[MainHeader][COMPONENT] MainHeader component called', { isEditingMain, nodeLabel: node.label, labelDraft });

  const labelRef = useRef<HTMLDivElement>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);

  // Log when editing state changes
  useEffect(() => {
    console.log('[MainHeader][EDITING_STATE] Editing state changed', {
      isEditingMain,
      nodeLabel: node.label,
      labelDraft,
      labelWidth,
      labelRefExists: !!labelRef.current,
      labelRefWidth: labelRef.current?.offsetWidth
    });
  }, [isEditingMain, node.label, labelDraft, labelWidth]);

  // Log on every render when editing
  if (isEditingMain) {
    console.log('[MainHeader][RENDER] Component rendered in EDITING mode', {
      labelWidth,
      labelDraft,
      nodeLabel: node.label,
      timestamp: Date.now()
    });
  }

  // Measure label width more robustly - always measure when labelRef is available
  useEffect(() => {
    if (labelRef.current && !isEditingMain) {
      const rect = labelRef.current.getBoundingClientRect();
      const width = rect.width;
      const computedStyle = window.getComputedStyle(labelRef.current);
      const offsetWidth = labelRef.current.offsetWidth;
      const scrollWidth = labelRef.current.scrollWidth;

      console.log('[MainHeader][WIDTH_MEASURE] Label measurement', {
        nodeLabel: node.label,
        isEditingMain,
        getBoundingClientRect: width,
        offsetWidth,
        scrollWidth,
        computedWidth: computedStyle.width,
        paddingLeft: computedStyle.paddingLeft,
        paddingRight: computedStyle.paddingRight,
        marginLeft: computedStyle.marginLeft,
        marginRight: computedStyle.marginRight,
        gap: computedStyle.gap,
        labelRefExists: !!labelRef.current,
        labelChildren: labelRef.current.children.length
      });

      setLabelWidth(width);
    }
  }, [node.label, isEditingMain]);

  // Use ResizeObserver for dynamic updates
  useEffect(() => {
    if (!labelRef.current || isEditingMain) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        console.log('[MainHeader][RESIZE_OBSERVER] Label resized', {
          width,
          contentRect: entry.contentRect,
          borderBoxSize: entry.borderBoxSize,
          contentBoxSize: entry.contentBoxSize
        });
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
        padding: 12,
        gap: 6,
        minWidth: labelWidth ? `fit-content` : undefined
      }}
      onMouseEnter={() => setHoverHeader(true)}
      onMouseLeave={() => setHoverHeader(false)}
    >
      {/* 📐 Riga 1: Label + Percentuale inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {!isEditingMain ? (
          <>
            <div ref={labelRef} style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ flexShrink: 0 }}><IconRenderer name={node.icon} size={16} /></span>
              <span style={{ fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{node.label || 'Field'}</span>

              {/* 🚀 NEW: Status display for main data */}
              {(() => {
                const fieldId = node.label || '';
                const state = getFieldProcessingState(fieldId);
                const progress = progressByPath?.[fieldId] || 0;
                const message = getStatusMessage(fieldId);
                const hasError = state?.status === 'error';

                if (progress > 0 || state) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                      {getStatusIcon(fieldId)}
                      <span style={{ color: hasError ? '#ef4444' : (progress >= 100 ? '#22c55e' : '#3b82f6') }}>
                        {Math.round(progress)}%
                      </span>
                      <span style={{ color: hasError ? '#ef4444' : '#64748b' }}>
                        {message}
                      </span>
                      {progress > 0 && progress < 100 && !hasError && <AnimatedDots />}
                      {hasError && onRetryField && (
                        <>
                          <button
                            onClick={() => onRetryField(fieldId)}
                            style={{
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                            title={state?.retryCount ? `Retry (attempt ${state.retryCount + 1})` : 'Retry'}
                          >
                            <RefreshCw size={12} />
                            Retry {state?.retryCount ? `(${state.retryCount})` : ''}
                          </button>
                          {/* Show manual creation button after 2+ failed retries */}
                          {(state?.retryCount ?? 0) >= 2 && onCreateManually && (
                            <button
                              onClick={() => onCreateManually()}
                              style={{
                                background: '#fbbf24',
                                color: '#0b1220',
                                border: 'none',
                                borderRadius: 4,
                                padding: '2px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 600
                              }}
                              title="Crea i messaggi manualmente nell'editor"
                            >
                              <FileEdit size={12} />
                              Crea manualmente
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
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
            {console.log('[MainHeader][RENDER] Rendering editing UI', { isEditingMain, labelWidth, fieldErrors: Object.keys(fieldErrors), labelDraft })}
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
                    if (inputEl && isEditingMain) {
                      setTimeout(() => {
                        const rect = inputEl.getBoundingClientRect();
                        const computedStyle = window.getComputedStyle(inputEl);
                        const parentRect = inputEl.parentElement?.getBoundingClientRect();
                        const containerRect = inputEl.closest('div[style*="padding"]')?.getBoundingClientRect();

                        console.log('[MainHeader][INPUT_RENDER] Input rendered in EDITING mode (ERROR)', {
                          inputWidth: rect.width,
                          inputHeight: rect.height,
                          inputLeft: rect.left,
                          inputRight: rect.right,
                          computedWidth: computedStyle.width,
                          computedMinWidth: computedStyle.minWidth,
                          computedMaxWidth: computedStyle.maxWidth,
                          computedFlexShrink: computedStyle.flexShrink,
                          computedFlexGrow: computedStyle.flexGrow,
                          computedFlexBasis: computedStyle.flexBasis,
                          padding: computedStyle.padding,
                          border: computedStyle.border,
                          boxSizing: computedStyle.boxSizing,
                          parentWidth: parentRect?.width,
                          parentLeft: parentRect?.left,
                          parentRight: parentRect?.right,
                          containerWidth: containerRect?.width,
                          labelWidthStored: labelWidth,
                          labelDraft: labelDraft,
                          actualInputValue: inputEl.value,
                          appliedStyles: {
                            width: labelWidth ? `${labelWidth}px` : undefined,
                            minWidth: labelWidth ? `${labelWidth}px` : 260,
                            flexShrink: 0
                          }
                        });
                      }, 0);
                    }
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
                    if (inputEl && isEditingMain) {
                      setTimeout(() => {
                        const rect = inputEl.getBoundingClientRect();
                        const computedStyle = window.getComputedStyle(inputEl);
                        const parentRect = inputEl.parentElement?.getBoundingClientRect();
                        const containerRect = inputEl.closest('div[style*="padding"]')?.getBoundingClientRect();

                        console.log('[MainHeader][INPUT_RENDER] Input rendered in EDITING mode (NORMAL)', {
                          inputWidth: rect.width,
                          inputHeight: rect.height,
                          inputLeft: rect.left,
                          inputRight: rect.right,
                          computedWidth: computedStyle.width,
                          computedMinWidth: computedStyle.minWidth,
                          computedMaxWidth: computedStyle.maxWidth,
                          computedFlexShrink: computedStyle.flexShrink,
                          computedFlexGrow: computedStyle.flexGrow,
                          computedFlexBasis: computedStyle.flexBasis,
                          padding: computedStyle.padding,
                          border: computedStyle.border,
                          boxSizing: computedStyle.boxSizing,
                          parentWidth: parentRect?.width,
                          parentLeft: parentRect?.left,
                          parentRight: parentRect?.right,
                          containerWidth: containerRect?.width,
                          labelWidthStored: labelWidth,
                          labelDraft: labelDraft,
                          actualInputValue: inputEl.value,
                          appliedStyles: {
                            width: labelWidth ? `${labelWidth}px` : undefined,
                            minWidth: labelWidth ? `${labelWidth}px` : 260,
                            flexShrink: 0
                          }
                        });
                      }, 0);
                    }
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
    </div>
  );
}

