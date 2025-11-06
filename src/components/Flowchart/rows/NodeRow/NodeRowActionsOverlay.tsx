import React from 'react';
import { Trash2, Edit3, Settings, Wrench, Brain } from 'lucide-react';
import SmartTooltip from '../../../SmartTooltip';

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
  hasDDT?: boolean;
  gearColor?: string;
  isCondition?: boolean;
  onWrenchClick?: () => void;
  onOpenDDT?: () => void;
  // NEW: act type icon and handler to open inline picker
  ActIcon?: React.ComponentType<any> | null;
  actColor?: string; // iconColor della riga (grigio se no DDT/messaggio, colorato se ha DDT/messaggio)
  onTypeChangeRequest?: (anchor: DOMRect) => void;
  onRequestClosePicker?: () => void;
  outerRef?: React.RefObject<HTMLDivElement>;
  onAIPromptToSystem?: () => void;
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
  hasDDT,
  gearColor,
  isCondition,
  onWrenchClick,
  onOpenDDT,
  ActIcon,
  actColor,
  onTypeChangeRequest,
  onRequestClosePicker,
  outerRef,
  onAIPromptToSystem
}) => {
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
      {/* Current ActType icon → opens inline type picker below */}
      {ActIcon && (
        <SmartTooltip text="Change act type" tutorId="act_type_help" placement="bottom">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Anchor to the icon itself (client coordinates for fixed positioning)
              const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onTypeChangeRequest && onTypeChangeRequest(anchor);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={(e) => {
              const anchor = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onTypeChangeRequest && onTypeChangeRequest(anchor);
              // Removed verbose log
            }}
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
            className="hover:opacity-100 hover:scale-110"
          >
            <ActIcon style={{ width: size, height: size, color: actColor || '#94a3b8', filter: actColor && actColor !== '#94a3b8' ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined }} />
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
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
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
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
            onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          >
            <Wrench style={{ width: size, height: size }} />
          </button>
        </SmartTooltip>
      )}
      {/* Gear (DDT) */}
      <SmartTooltip
        text="Manually define this task's behavior using the rule editor."
        tutorId="gear_tooltip_help"
        placement="bottom"
      >
        <button
          style={{ display: 'flex', alignItems: 'center', padding: 2, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
          className="hover:opacity-100 hover:scale-110 nodrag"
          onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenDDT && onOpenDDT();
          }}
        >
          <Settings style={{ width: size, height: size, color: hasDDT ? (gearColor || '#fbbf24') : '#9ca3af', filter: hasDDT ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined }} />
        </button>
      </SmartTooltip>
      {/* AI Prompt to System (Brain) */}
      <SmartTooltip
        text="Handle by AI at runtime instead of rule-based logic"
        tutorId="ai_prompt_help"
        placement="bottom"
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAIPromptToSystem && onAIPromptToSystem();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="text-slate-300 hover:text-amber-300 transition-colors hover:opacity-100 hover:scale-110 nodrag"
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.9, transition: 'opacity 120ms linear, transform 120ms ease' }}
          onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
        >
          <Brain style={{ width: size, height: size }} />
        </button>
      </SmartTooltip>
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
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', opacity: 0.95, transition: 'opacity 120ms linear, transform 120ms ease' }}
            onMouseEnter={() => onRequestClosePicker && onRequestClosePicker()}
          >
            <Trash2 style={{ width: size, height: size }} />
          </button>
        </SmartTooltip>
      )}
    </div>
  );
};