import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Wrench, Link2Off as LinkOff } from 'lucide-react';
import { useDynamicFontSizes } from '../../../../hooks/useDynamicFontSizes';
import { calculateFontBasedSizes } from '../../../../utils/fontSizeUtils';
import { VoiceInput } from '../../../common/VoiceInput';
import { useCompilationErrors } from '../../../../context/CompilationErrorsContext';
import { useEdgeErrors } from '../../hooks/useEdgeErrors';

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

  // Update editing value when label changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditingValue(label || '');
    }
  }, [label, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setEditingValue(label || '');
    setIsEditing(true);
  }, [label]);

  const handleSaveEdit = useCallback(() => {
    if (onEdit) {
      onEdit(editingValue);
    }
    setIsEditing(false);
  }, [editingValue, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingValue(label || '');
    setIsEditing(false);
  }, [label]);

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

  // Early return AFTER all hooks
  if (!label && !isEditing) {
    return null;
  }

  // Use drag position if dragging, otherwise use normal position
  const displayPosition = isDragging && dragPosition ? dragPosition : position;

  const labelContent = isEditing ? (
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

  return createPortal(
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
        transform: 'translate(-50%, -50%)',
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
        pointerEvents: 'auto',
        zIndex: isDragging ? 1000 : 10,
        boxShadow: isDragging
          ? '0 4px 12px rgba(139,92,246,0.30)'
          : '0 2px 8px rgba(139,92,246,0.10)',
        minWidth: 30,
        minHeight: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: isDragging ? 'none' : 'text',
        whiteSpace: 'pre',
        gap: 4,
        cursor: !isEditing ? 'move' : 'default',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {labelContent}
      {isHovered && !isEditing && (
        <span
          ref={toolbarRef as any}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
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
            onClick={(e) => {
              e.stopPropagation();
              onUncondition?.();
            }}
          >
            <LinkOff size={sizes.iconSize} />
          </button>
        </span>
      )}
    </div>,
    document.body
  );
};
