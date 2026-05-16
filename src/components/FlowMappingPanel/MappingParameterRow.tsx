/**
 * Leaf parameter row chrome: label + value box, text-only hottrack, portal toolbar, optional HTML5 drag + ghost.
 */

import React, { useRef, useState, useCallback } from 'react';
import { setMappingDragLabelGhost } from './mappingDragGhost';
import { MappingParameterToolbarPortal } from './MappingParameterToolbarPortal';

const HIDE_DELAY_MS = 120;

export interface MappingParameterRowDragConfig {
  /** Ghost label (usually wireKey or segment). */
  label: string;
  onDragStart: (e: React.DragEvent) => void;
}

export interface MappingParameterRowProps {
  label: React.ReactNode;
  fields: React.ReactNode;
  toolbar: React.ReactNode;
  drag?: MappingParameterRowDragConfig;
  className?: string;
  labelClassName?: string;
  fieldsClassName?: string;
}

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('button, input, textarea, select, [role="combobox"], [contenteditable="true"]')
  );
}

export function MappingParameterRow({
  label,
  fields,
  toolbar,
  drag,
  className = '',
  labelClassName = 'min-w-0 flex-1',
  fieldsClassName = 'relative flex min-h-[22px] min-w-0 shrink-0 items-center',
}: MappingParameterRowProps): React.ReactElement {
  const valueAnchorRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    clearHideTimer();
    setHovered(true);
  }, [clearHideTimer]);

  const onLeave = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setHovered(false), HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const handleDragStart = (e: React.DragEvent) => {
    if (!drag) return;
    if (isInteractiveDragTarget(e.target)) {
      e.preventDefault();
      return;
    }
    drag.onDragStart(e);
    setMappingDragLabelGhost(e, drag.label);
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1 ${drag ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      draggable={Boolean(drag)}
      onDragStart={handleDragStart}
    >
      <div className={labelClassName}>{label}</div>
      <div ref={valueAnchorRef} className={fieldsClassName}>
        {fields}
      </div>
      <MappingParameterToolbarPortal
        anchorRef={valueAnchorRef}
        visible={hovered}
        onPointerHoverChange={setHovered}
      >
        {toolbar}
      </MappingParameterToolbarPortal>
    </div>
  );
}
