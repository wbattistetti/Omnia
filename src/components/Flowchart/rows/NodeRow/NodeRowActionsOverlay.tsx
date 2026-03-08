import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Edit3, Settings, Wrench, Check, Play, AlertTriangle, Info } from 'lucide-react';
import SmartTooltip from '../../../SmartTooltip';
import { ErrorTooltip } from '../../components/ErrorTooltip';
import type { RowErrorsResult } from '../../hooks/useRowErrors';
import type { CompilationError } from '../../../../FlowCompiler/types';

interface NodeRowActionsOverlayProps {
  iconPos: { top: number; left: number };
  showIcons: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDrag: (e: React.MouseEvent) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  labelRef: React.RefObject<HTMLSpanElement>;
  onHoverChange?: (v: boolean) => void;
  iconSize?: number;
  hasTaskTree?: boolean;
  gearColor?: string;
  gearDisabled?: boolean; // ✅ Disabilita ingranaggio se tipo UNDEFINED e nessun template match
  isCondition?: boolean;
  onWrenchClick?: () => void;
  onOpenTaskTree?: () => void;
  // Task type icon and handler to open inline picker
  TaskIcon?: React.ComponentType<any> | null;
  taskColor?: string;
  onTypeChangeRequest?: (anchor: DOMRect) => void;
  onRequestClosePicker?: () => void;
  buttonCloseTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
  outerRef?: React.RefObject<HTMLDivElement>;
  included?: boolean;
  setIncluded?: (val: boolean) => void;
  // Test task button
  onTestTask?: () => void; // Callback to test the task instance
  // ✅ Compilation errors props
  rowErrors?: RowErrorsResult;
  onErrorClick?: (e: React.MouseEvent) => void;
  errorIconRef?: React.RefObject<HTMLButtonElement>;
  showErrorPopover?: boolean;
  onCloseErrorPopover?: () => void;
  onErrorFix?: (error: CompilationError) => void;
}

export const NodeRowActionsOverlay: React.FC<NodeRowActionsOverlayProps> = ({
  iconPos,
  showIcons,
  canDelete,
  onEdit,
  onDelete,
  onDrag,
  isEditing,
  setIsEditing,
  labelRef,
  onHoverChange,
  iconSize,
  hasTaskTree,
  gearColor,
  gearDisabled,
  isCondition,
  onWrenchClick,
  onOpenTaskTree,
  TaskIcon,
  taskColor,
  onTypeChangeRequest,
  onRequestClosePicker,
  buttonCloseTimeoutRef,
  outerRef,
  included,
  setIncluded,
  onTestTask,
  rowErrors,
  onErrorClick,
  errorIconRef,
  showErrorPopover,
  onCloseErrorPopover,
  onErrorFix
}) => {
  // ✅ Toolbar appears only on hover (showIcons), error icon is added at the end if errors exist
  if (!showIcons || !iconPos) return null;
  // Calculate icon size based on font size (same as primary icons) - 119% of font size
  const size = typeof iconSize === 'number' ? iconSize : (labelRef.current ? (() => {
    const computedStyle = window.getComputedStyle(labelRef.current);
    const fontSize = parseFloat(computedStyle.fontSize) || 12;
    return Math.max(16, Math.min(32, Math.round(fontSize * 1.19)));
  })() : 16);
  return (
    <div
      ref={outerRef}
      style={{
        position: 'fixed',
        top: iconPos.top + 3,
        left: iconPos.left,
        display: 'flex',
        gap: 4,
        zIndex: 1000,
        background: 'transparent',
        borderRadius: 0,
        boxShadow: 'none',
        padding: '8px', // Extended padding for easier hover targeting
        margin: '-8px', // Negative margin to keep visual position same
        alignItems: 'center',
        border: 'none',
        height: labelRef.current ? `${labelRef.current.getBoundingClientRect().height + 16}px` : `${size + 24}px`,
        minHeight: 0,
        pointerEvents: 'auto'
      }}
      className="flex items-center"
      onMouseEnter={() => { onHoverChange && onHoverChange(true); }}
      onMouseLeave={() => { onHoverChange && onHoverChange(false); }}
    >
      {/* Current TaskType icon - opens inline type picker below */}
      {TaskIcon && (
        <SmartTooltip text="Change task type" tutorId="task_type_help" placement="top">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={(e) => {
              // Clear any pending close timeout when mouse enters button
              if (buttonCloseTimeoutRef && buttonCloseTimeoutRef.current) {
                clearTimeout(buttonCloseTimeoutRef.current);
                buttonCloseTimeoutRef.current = null;
              }
              const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onTypeChangeRequest && onTypeChangeRequest(anchor);
            }}
            onMouseLeave={() => {
              // Use timeout instead of closing immediately to allow mouse to reach menu
              if (buttonCloseTimeoutRef && buttonCloseTimeoutRef.current) {
                clearTimeout(buttonCloseTimeoutRef.current);
              }
              // Set timeout to close picker after delay (allows mouse to reach menu)
              if (buttonCloseTimeoutRef) {
                buttonCloseTimeoutRef.current = setTimeout(() => {
                  onRequestClosePicker && onRequestClosePicker();
                  if (buttonCloseTimeoutRef) {
                    buttonCloseTimeoutRef.current = null;
                  }
                }, 200); // Same delay as menu's handleMouseLeave
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              opacity: 0.9,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            className="hover:opacity-100 hover:scale-110"
          >
            <TaskIcon style={{
              width: size,
              height: size,
              color: (!included) ? '#9ca3af' : (taskColor || '#94a3b8'),
              filter: (included && taskColor && taskColor !== '#94a3b8') ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined
            }} />
          </button>
        </SmartTooltip>
      )}
      {/* Play (Test Task) - Only show if onTestTask is provided */}
      {onTestTask && (
        <SmartTooltip text="Test task instance" tutorId="test_task_help" placement="bottom">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTestTask();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-green-400 hover:text-green-300 transition-colors hover:opacity-100 hover:scale-110 nodrag"
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              opacity: 0.9,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          >
            <Play style={{ width: size, height: size }} />
          </button>
        </SmartTooltip>
      )}
      {/* Matita (edit) */}
      <SmartTooltip text="Edit row" tutorId="edit_row_help" placement="bottom">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="text-slate-300 hover:text-amber-300 transition-colors hover:opacity-100 hover:scale-110 nodrag"
          style={{
            background: 'none',
            border: 'none',
            padding: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            opacity: 0.9,
            transition: 'opacity 120ms linear, transform 120ms ease'
          }}
          onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
        >
          <Edit3 style={{ width: size, height: size }} />
        </button>
      </SmartTooltip>
      {/* Wrench (Condition) - subito dopo la matita se è una condition */}
      {isCondition && (
        <SmartTooltip text="Edit condition" tutorId="edit_condition_help" placement="bottom">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWrenchClick && onWrenchClick();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-slate-300 hover:text-amber-300 transition-colors hover:opacity-100 hover:scale-110 nodrag"
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              opacity: 0.9,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          >
            <Wrench style={{ width: size, height: size }} />
          </button>
        </SmartTooltip>
      )}
      {/* Gear (TaskTree) */}
      <SmartTooltip
        text={gearDisabled ? "You must first choose the task type" : "Manually define this task's behavior using the rule editor."}
        tutorId="gear_tooltip_help"
        placement="bottom"
      >
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 2,
            background: 'none',
            border: 'none',
            cursor: 'pointer', // ✅ Sempre pointer, anche quando disabilitato (cliccabile per aprire picker)
            width: size,
            height: size,
            opacity: gearDisabled ? 0.5 : 0.9,
            transition: 'opacity 120ms linear, transform 120ms ease'
          }}
          className="hover:opacity-100 hover:scale-110 nodrag"
          onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          onMouseDown={(e) => {
            // ✅ NON fare preventDefault qui - potrebbe interferire con il click
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // ✅ Se gearDisabled è true (tipo UNDEFINED), apri il picker del tipo
            // ✅ Gestisci anche il caso in cui gearDisabled è undefined ma onOpenTaskTree non è disponibile
            const isDisabled = gearDisabled === true;
            const hasOpenTaskTree = typeof onOpenTaskTree === 'function';
            const shouldOpenPicker = isDisabled || (!hasOpenTaskTree && onTypeChangeRequest);

            if (shouldOpenPicker && onTypeChangeRequest) {
              // ✅ Se tipo UNDEFINED o se onOpenTaskTree non disponibile, apri il picker del tipo (come se cliccassi sul primo pulsante)
              // ✅ Usa la posizione del pulsante ingranaggio stesso per aprire il picker
              const gearRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              if (gearRect && onTypeChangeRequest) {
                onTypeChangeRequest(gearRect);
              }
            } else if (onOpenTaskTree) {
              try {
                onOpenTaskTree();
              } catch (error) {
                console.error('[NodeRowActionsOverlay] Error calling onOpenTaskTree:', error);
              }
            } else {
              console.warn('[NodeRowActionsOverlay] No action available', {
                gearDisabled,
                hasOnOpenTaskTree: !!onOpenTaskTree,
                hasOnTypeChangeRequest: !!onTypeChangeRequest
              });
            }
          }}
          // ✅ NON usare disabled - vogliamo che il click funzioni anche quando è "disabilitato" per aprire il picker
        >
          <Settings style={{ width: size, height: size, color: hasTaskTree ? (gearColor || '#fbbf24') : '#9ca3af', filter: hasTaskTree ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined }} />
        </button>
      </SmartTooltip>
      {/* Checkbox: moved from left side to toolbar, before trash icon */}
      {included !== undefined && setIncluded && (
        <SmartTooltip text="Include this row in the flow" tutorId="include_row_help" placement="bottom">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIncluded(!included);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-slate-300 hover:text-amber-300 transition-colors hover:opacity-100 hover:scale-110 nodrag"
            style={{
              padding: 2,
              cursor: 'pointer',
              opacity: 0.9,
              transition: 'opacity 120ms linear, transform 120ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              borderRadius: 3,
              border: included ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.6)',
              background: included ? 'transparent' : '#e5e7eb',
            }}
          >
            {included ? (
              <Check style={{ width: size * 0.7, height: size * 0.7, color: 'rgba(255,255,255,0.9)' }} />
            ) : null}
          </button>
        </SmartTooltip>
      )}
      {/* Cestino (delete) */}
      {canDelete && (
        <SmartTooltip text="Delete row" tutorId="delete_row_help" placement="bottom">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="text-red-400 hover:text-red-500 transition-colors hover:opacity-100 hover:scale-110 nodrag"
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              opacity: 0.95,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          >
            <Trash2 style={{ width: size, height: size }} />
          </button>
        </SmartTooltip>
      )}
      {/* ✅ Error Icon - Added at the end of toolbar, only visible when toolbar is shown (on hover) */}
      {rowErrors && (rowErrors.hasError || rowErrors.hasWarning) && (
        <div style={{ position: 'relative' }}>
          <button
            ref={errorIconRef}
            onClick={onErrorClick}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="nodrag"
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              opacity: 0.9,
              transition: 'opacity 120ms linear, transform 120ms ease'
            }}
            onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          >
            <AlertTriangle
              style={{
                width: size,
                height: size,
                color: rowErrors.hasError ? '#ef4444' : '#f59e0b' // Red for error, orange for warning
              }}
            />
          </button>
          {/* Error Popover - shown when icon is clicked */}
          {showErrorPopover && errorIconRef.current && rowErrors.errors.length > 0 && (
            <ErrorPopover
              errors={rowErrors.errors}
              anchorRef={errorIconRef}
              onClose={onCloseErrorPopover}
              onFix={onErrorFix}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ✅ Error Popover Component
interface ErrorPopoverProps {
  errors: CompilationError[];
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  onFix?: (error: CompilationError) => void;
}

const ErrorPopover: React.FC<ErrorPopoverProps> = ({ errors, anchorRef, onClose, onFix }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef.current) return;

    const updatePosition = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: rect.left
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    // Close on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [anchorRef, onClose]);

  if (!position) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10000,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <ErrorTooltip errors={errors} onFix={onFix} onClose={onClose} />
    </div>
  );
};