import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Wrench, Link2Off as LinkOff, AlertTriangle } from 'lucide-react';
import { useDynamicFontSizes } from '../../../../hooks/useDynamicFontSizes';
import { calculateFontBasedSizes } from '../../../../utils/fontSizeUtils';
import { VoiceInput } from '../../../common/VoiceInput';
import { useCompilationErrors } from '../../../../context/CompilationErrorsContext';
import { useEdgeErrors } from '../../hooks/useEdgeErrors';
import type { CompilationError } from '../../../../FlowCompiler/types';
import { ErrorTooltip } from '../../components/ErrorTooltip';

export interface EdgeLabelProps {
  label: string | undefined;
  position: { x: number; y: number };
  isHovered: boolean;
  onEdit?: (newLabel: string) => void;
  onUncondition?: () => void;
  onOpenConditionEditor?: () => void;
  hasConditionScript?: boolean;
  isElse?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  toolbarRef?: React.RefObject<HTMLElement>;
  labelRef?: React.RefObject<HTMLElement>;
  dragPosition?: { x: number; y: number } | null;
  isDragging?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  edgeId?: string; // ✅ Add edgeId prop for error detection
  /** Da matita su link senza label: mostra subito la textbox. */
  allowEmptyRender?: boolean;
  onEmptyLabelEditFinished?: () => void;
  /** Caption presente ma senza condizione collegata → stile attenuato (grigio). */
  captionMuted?: boolean;
}

/**
 * Edge label component with inline editing and toolbar
 * Handles caption display, editing, and toolbar actions
 */
export const EdgeLabel: React.FC<EdgeLabelProps> = ({
  label,
  position,
  isHovered,
  onEdit,
  onUncondition,
  onOpenConditionEditor,
  hasConditionScript = false,
  isElse = false,
  onMouseEnter,
  onMouseLeave,
  toolbarRef,
  labelRef,
  dragPosition,
  isDragging = false,
  onMouseDown,
  edgeId, // ✅ Add edgeId
  allowEmptyRender = false,
  onEmptyLabelEditFinished,
  captionMuted = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingValue, setEditingValue] = useState(label || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const fontSizes = useDynamicFontSizes();
  const sizes = calculateFontBasedSizes(fontSizes.edgeCaption);

  // ✅ COMPILATION ERRORS: Get errors for this edge
  const { errors: compilationErrors } = useCompilationErrors();
  const edgeErrors = edgeId ? useEdgeErrors(edgeId, compilationErrors) : null;

  // ✅ Determine label color based on errors
  const labelColor = edgeErrors && edgeErrors.strokeColor !== 'transparent'
    ? edgeErrors.strokeColor
    : '#8b5cf6'; // Default purple

  // ✅ Error popover state
  const [showErrorPopover, setShowErrorPopover] = useState(false);
  const errorIconRef = useRef<HTMLButtonElement>(null);

  // ✅ Handle error icon click
  const handleErrorClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowErrorPopover(true);
  }, []);

  // ✅ Handle error fix
  const handleErrorFix = useCallback(async (error: CompilationError) => {
    setShowErrorPopover(false);
    const { handleErrorFix: handleErrorFixCentral } = await import('../../../../utils/handleErrorFix');
    await handleErrorFixCentral(error);
  }, []);

  // ✅ Close popover on outside click
  useEffect(() => {
    if (!showErrorPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (errorIconRef.current && !errorIconRef.current.contains(e.target as Node)) {
        setShowErrorPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showErrorPopover]);

  // Sincronizza testo: da matita (allowEmptyRender) o quando non si sta editando
  useEffect(() => {
    if (allowEmptyRender) {
      setEditingValue(label || '');
    } else if (!isEditing) {
      setEditingValue(label || '');
    }
  }, [label, isEditing, allowEmptyRender]);

  const showInput = isEditing || !!allowEmptyRender;

  // Focus input when entering edit mode (anche apertura da matita senza label)
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showInput]);

  const handleStartEdit = useCallback(() => {
    setEditingValue(label || '');
    setIsEditing(true);
  }, [label]);

  const handleSaveEdit = useCallback(() => {
    if (onEdit) {
      onEdit(editingValue);
    }
    setIsEditing(false);
    if (allowEmptyRender) {
      onEmptyLabelEditFinished?.();
    }
  }, [editingValue, onEdit, allowEmptyRender, onEmptyLabelEditFinished]);

  const handleCancelEdit = useCallback(() => {
    setEditingValue(label || '');
    setIsEditing(false);
    if (allowEmptyRender) {
      onEmptyLabelEditFinished?.();
    }
  }, [label, allowEmptyRender, onEmptyLabelEditFinished]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSaveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  // IMPORTANT: All hooks must be called before any early returns

  // Early return AFTER all hooks (allowEmptyRender = matita su link senza testo)
  if (!label && !showInput) {
    return null;
  }

  // ✅ REFACTOR: EdgeLabelRenderer gestisce le trasformazioni SVG automaticamente
  // Le coordinate sono già in formato SVG, EdgeLabelRenderer le trasforma
  const displayPosition = isDragging && dragPosition ? dragPosition : position;

  const labelContent = showInput ? (
    <VoiceInput
      ref={inputRef}
      type="text"
      value={editingValue}
      onChange={(e) => setEditingValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSaveEdit}
      style={{
        fontSize: fontSizes.edgeCaption,
        padding: '2px 8px',
        border: '2px solid #8b5cf6',
        borderRadius: '4px',
        background: '#fff',
        minWidth: '100px',
        outline: 'none',
      }}
      autoStartWhenEmpty={false}
    />
  ) : (
    <span ref={labelRef as any} style={{ position: 'relative' }}>
      {label}
    </span>
  );

  // ✅ REFACTOR: Renderizza direttamente invece di createPortal
  // EdgeLabelRenderer gestirà le trasformazioni SVG automaticamente
  // Le coordinate sono in formato SVG, EdgeLabelRenderer le converte in screen
  return (
    <div
      title={
        isElse
          ? 'Else: ramo di fallback quando le altre condizioni sono false'
          : undefined
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        left: displayPosition.x,
        top: displayPosition.y,
        transform: 'translate(-50%, -50%) rotate(0deg)', // ✅ Label always horizontal
        background: edgeErrors && edgeErrors.strokeColor !== 'transparent'
          ? (edgeErrors.hasError
              ? 'rgba(239, 68, 68, 0.2)' // red-500 with 20% transparency
              : 'rgba(245, 158, 11, 0.2)') // orange-500 with 20% transparency
          : 'transparent',
        border: edgeErrors && edgeErrors.strokeColor !== 'transparent'
          ? `1px solid ${edgeErrors.strokeColor}` // ✅ Add border if error
          : 'none',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: fontSizes.edgeCaption,
        color: labelColor, // ✅ Apply error color to label text
        pointerEvents: isDragging ? 'none' : 'auto', // ✅ CRITICAL FIX: durante drag, lascia passare eventi SVG alle hit-area
        zIndex: isDragging ? 1000 : 10,
        boxShadow: isDragging
          ? captionMuted
            ? '0 4px 12px rgba(100,116,139,0.22)'
            : '0 4px 12px rgba(139,92,246,0.30)'
          : captionMuted
            ? '0 2px 8px rgba(100,116,139,0.12)'
            : '0 2px 8px rgba(139,92,246,0.10)',
        minWidth: 30,
        minHeight: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: isDragging ? 'none' : 'text',
        whiteSpace: 'pre',
        gap: 4,
        cursor: !showInput ? 'move' : 'default',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {labelContent}
      {isHovered && !showInput && (
        <span
          ref={toolbarRef as any}
          data-toolbar="true"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onMouseDown={(e) => {
            // ✅ FIX: Prevent drag when clicking on toolbar buttons
            e.stopPropagation();
          }}
          style={{
            position: 'absolute',
            left: '100%',
            marginLeft: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            top: '50%',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
          }}
        >
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#8b5cf6',
              width: `${sizes.iconButtonSize}px`,
              height: `${sizes.iconButtonSize}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: `${sizes.iconButtonSize}px`,
              minHeight: `${sizes.iconButtonSize}px`,
            }}
            title="Modifica label"
            onMouseDown={(e) => {
              // ✅ FIX: Prevent drag when clicking this button
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
          >
            <Pencil size={sizes.iconSize} />
          </button>
          {!hasConditionScript && (
            <button
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: '#0ea5e9',
                width: `${sizes.iconButtonSize}px`,
                height: `${sizes.iconButtonSize}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: `${sizes.iconButtonSize}px`,
                minHeight: `${sizes.iconButtonSize}px`,
              }}
              title="Apri Condition Editor"
              onMouseDown={(e) => {
                // ✅ FIX: Prevent drag when clicking this button (tenaglia)
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenConditionEditor?.();
              }}
            >
              <Wrench size={sizes.iconSize} />
            </button>
          )}
          <button
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#888',
              width: `${sizes.iconButtonSize}px`,
              height: `${sizes.iconButtonSize}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: `${sizes.iconButtonSize}px`,
              minHeight: `${sizes.iconButtonSize}px`,
            }}
            title="Rendi unconduitioned"
            onMouseDown={(e) => {
              // ✅ FIX: Prevent drag when clicking this button
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onUncondition?.();
            }}
          >
            <LinkOff size={sizes.iconSize} />
          </button>
          {/* ✅ Error Icon - Added at the end of toolbar, only visible when errors exist */}
          {edgeErrors && (edgeErrors.hasError || edgeErrors.hasWarning) && (
            <div style={{ position: 'relative' }}>
              <button
                ref={errorIconRef}
                onClick={handleErrorClick}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: `${sizes.iconButtonSize}px`,
                  height: `${sizes.iconButtonSize}px`,
                  minWidth: `${sizes.iconButtonSize}px`,
                  minHeight: `${sizes.iconButtonSize}px`,
                  opacity: 0.9,
                  transition: 'opacity 120ms linear, transform 120ms ease'
                }}
                title={edgeErrors.hasError ? 'Errori di compilazione' : 'Avvisi di compilazione'}
              >
                <AlertTriangle
                  size={sizes.iconSize}
                  style={{
                    color: edgeErrors.hasError ? '#ef4444' : '#f59e0b' // Red for error, orange for warning
                  }}
                />
              </button>
              {/* Error Popover - shown when icon is clicked */}
              {showErrorPopover && errorIconRef.current && edgeErrors.errors.length > 0 && (
                <ErrorPopoverPortal
                  errors={edgeErrors.errors}
                  anchorRef={errorIconRef}
                  onClose={() => setShowErrorPopover(false)}
                  onFix={handleErrorFix}
                />
              )}
            </div>
          )}
        </span>
      )}
    </div>
  );
};

// ✅ Error Popover Portal Component (similar to NodeRowActionsOverlay)
interface ErrorPopoverPortalProps {
  errors: CompilationError[];
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  onFix?: (error: CompilationError) => void;
}

const ErrorPopoverPortal: React.FC<ErrorPopoverPortalProps> = ({ errors, anchorRef, onClose, onFix }) => {
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

  return createPortal(
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
    </div>,
    document.body
  );
};
