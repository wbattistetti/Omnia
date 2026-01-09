import React from 'react';
import { Trash2, Edit3, Settings, Wrench, Check } from 'lucide-react';
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
  gearDisabled?: boolean; // ✅ Disabilita ingranaggio se tipo UNDEFINED e nessun template match
  isCondition?: boolean;
  onWrenchClick?: () => void;
  onOpenDDT?: () => void;
  // NEW: task type icon and handler to open inline picker
  TaskIcon?: React.ComponentType<any> | null; // ✅ RINOMINATO: ActIcon → TaskIcon
  taskColor?: string; // ✅ RINOMINATO: actColor → taskColor - iconColor della riga (grigio se no DDT/messaggio, colorato se ha DDT/messaggio)
  onTypeChangeRequest?: (anchor: DOMRect) => void;
  onRequestClosePicker?: () => void;
  buttonCloseTimeoutRef?: React.MutableRefObject<NodeJS.Timeout | null>;
  outerRef?: React.RefObject<HTMLDivElement>;
  included?: boolean;
  setIncluded?: (val: boolean) => void;
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
  gearDisabled,
  isCondition,
  onWrenchClick,
  onOpenDDT,
  TaskIcon, // ✅ RINOMINATO: ActIcon → TaskIcon
  taskColor, // ✅ RINOMINATO: actColor → taskColor
  onTypeChangeRequest,
  onRequestClosePicker,
  buttonCloseTimeoutRef,
  outerRef,
  included,
  setIncluded
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
      {/* Current TaskType icon → opens inline type picker below */}
      {TaskIcon && ( // ✅ RINOMINATO: ActIcon → TaskIcon
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
            <TaskIcon style={{ // ✅ RINOMINATO: ActIcon → TaskIcon
              width: size,
              height: size,
              color: (!included) ? '#9ca3af' : (taskColor || '#94a3b8'), // ✅ RINOMINATO: actColor → taskColor - Grigio se unchecked
              filter: (included && taskColor && taskColor !== '#94a3b8') ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined // ✅ RINOMINATO: actColor → taskColor
            }} />
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
      {/* Gear (DDT) */}
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
            console.log('🔧 [GEAR] Click ricevuto su ingranaggio', {
              gearDisabled,
              hasOnTypeChangeRequest: !!onTypeChangeRequest,
              hasOnOpenDDT: !!onOpenDDT,
              rowId: (e.currentTarget as any).closest('[data-row-id]')?.getAttribute('data-row-id')
            });
            // ✅ Se gearDisabled è true (tipo UNDEFINED), apri il picker del tipo
            // ✅ Gestisci anche il caso in cui gearDisabled è undefined ma onOpenDDT non è disponibile
            const isDisabled = gearDisabled === true;
            const hasOpenDDT = typeof onOpenDDT === 'function';
            const shouldOpenPicker = isDisabled || (!hasOpenDDT && onTypeChangeRequest);

            if (shouldOpenPicker && onTypeChangeRequest) {
              // ✅ Se tipo UNDEFINED o se onOpenDDT non disponibile, apri il picker del tipo (come se cliccassi sul primo pulsante)
              console.log('🔧 [GEAR] Click su ingranaggio - apertura picker tipo (come primo pulsante)', {
                rowId: (e.currentTarget as any).closest('[data-row-id]')?.getAttribute('data-row-id'),
                isDisabled,
                shouldOpenPicker
              });
              // ✅ Usa la posizione del pulsante ingranaggio stesso per aprire il picker
              const gearRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              console.log('🔧 [GEAR] Posizione ingranaggio:', gearRect);
              if (gearRect && onTypeChangeRequest) {
                console.log('🔧 [GEAR] Chiamando onTypeChangeRequest con rect:', gearRect);
                onTypeChangeRequest(gearRect);
              } else {
                console.warn('⚠️ [GEAR] Impossibile ottenere posizione o onTypeChangeRequest non disponibile', {
                  hasGearRect: !!gearRect,
                  hasOnTypeChangeRequest: !!onTypeChangeRequest
                });
              }
            } else if (onOpenDDT) {
              console.log('🔧 [GEAR] Click su ingranaggio - apertura ResponseEditor', {
                rowId: (e.currentTarget as any).closest('[data-row-id]')?.getAttribute('data-row-id'),
                hasDDT
              });
              try {
                onOpenDDT();
              } catch (error) {
                console.error('❌ [GEAR] Errore chiamando onOpenDDT', {
                  error,
                  errorMessage: error instanceof Error ? error.message : String(error)
                });
              }
            } else {
              console.warn('⚠️ [GEAR] Nessuna azione disponibile', {
                gearDisabled,
                hasOnOpenDDT: !!onOpenDDT,
                hasOnTypeChangeRequest: !!onTypeChangeRequest
              });
            }
          }}
          // ✅ NON usare disabled - vogliamo che il click funzioni anche quando è "disabilitato" per aprire il picker
        >
          <Settings style={{ width: size, height: size, color: hasDDT ? (gearColor || '#fbbf24') : '#9ca3af', filter: hasDDT ? 'drop-shadow(0 0 2px rgba(251,191,36,0.6))' : undefined }} />
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
    </div>
  );
};