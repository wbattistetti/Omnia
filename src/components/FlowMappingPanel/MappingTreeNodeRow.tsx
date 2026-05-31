/**
 * Single source of truth for mapping tree row layout: one horizontal chain per node.
 * Chevron? | Arrow? | LabelLeading? | Label | LabelSuffix? | Value editor? | AfterEditor?
 * Slots omitted when absent — no shared column grid across rows.
 */

import React, { useCallback, useRef, useState } from 'react';
import { MappingParameterToolbarPortal } from './MappingParameterToolbarPortal';
import { MAPPING_ROW_CELL_H, MAPPING_ROW_MIN_H } from './mappingPanelTypography';
import {
  BACKEND_TREE_ARROW_SLOT_PX,
  BACKEND_TREE_CHEVRON_SLOT_PX,
} from './backendMappingTreeLayout';

const HIDE_DELAY_MS = 120;
/** Fixed gap between consecutive visible slots on the same row. */
const ROW_SLOT_GAP_CLASS = 'gap-[5px]';

function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('button, input, textarea, select, [role="combobox"], [contenteditable="true"]')
  );
}

export interface MappingTreeNodeRowDragConfig {
  label: string;
  onDragStart: (e: React.DragEvent) => void;
}

export interface MappingTreeNodeRowProps {
  /** Shifts the entire node chain (tree depth); does not create cross-row columns. */
  depthIndentPx?: number;
  rowRef?: React.Ref<HTMLDivElement>;
  rowClassName?: string;
  /** Omit or null when the node has no children (no chevron column). */
  chevron?: React.ReactNode | null;
  arrow?: React.ReactNode | null;
  isGroup: boolean;
  label: React.ReactNode;
  labelSuffix?: React.ReactNode;
  labelLeading?: React.ReactNode;
  valueEditor?: React.ReactNode | null;
  afterEditor?: React.ReactNode | null;
  toolbar?: React.ReactNode | null;
  trailing?: React.ReactNode | null;
  /** Albero backend: slot chevron/freccia a larghezza fissa anche se vuoti. */
  fixedTreeSlots?: boolean;
  drag?: MappingTreeNodeRowDragConfig;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragOverCapture?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  rowProps?: Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'className' | 'children' | 'onDragOver' | 'onDrop' | 'onDragStart' | 'draggable'
  >;
}

export function MappingTreeNodeRow({
  depthIndentPx = 0,
  rowRef,
  rowClassName = '',
  chevron,
  arrow,
  isGroup,
  label,
  labelSuffix,
  labelLeading,
  valueEditor,
  afterEditor,
  toolbar,
  trailing,
  fixedTreeSlots = false,
  drag,
  draggable: draggableProp,
  onDragStart: onDragStartProp,
  onDragOver,
  onDragOverCapture,
  onDrop,
  onMouseEnter,
  onMouseLeave,
  rowProps,
}: MappingTreeNodeRowProps): React.ReactElement {
  const valueAnchorRef = useRef<HTMLDivElement>(null);
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handlePointerEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (toolbar) {
        clearHideTimer();
        setToolbarHovered(true);
      }
      onMouseEnter?.(e);
    },
    [clearHideTimer, onMouseEnter, toolbar]
  );

  const handlePointerLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (toolbar) {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => setToolbarHovered(false), HIDE_DELAY_MS);
      }
      onMouseLeave?.(e);
    },
    [clearHideTimer, onMouseLeave, toolbar]
  );

  const draggable = Boolean(draggableProp ?? drag);
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (onDragStartProp) {
      onDragStartProp(e);
      return;
    }
    if (!drag) return;
    if (isInteractiveDragTarget(e.target)) {
      e.preventDefault();
      return;
    }
    drag.onDragStart(e);
  };

  const showValue = !isGroup && valueEditor != null;
  const showChevronSlot = fixedTreeSlots || chevron != null;
  const showArrowSlot = fixedTreeSlots ? !isGroup : !isGroup && arrow != null;
  const { style: rowStyle, ...rowRest } = rowProps ?? {};

  return (
    <>
      <div
        ref={rowRef}
        {...rowRest}
        className={`group/row flex w-max max-w-full min-w-0 flex-nowrap items-center ${ROW_SLOT_GAP_CLASS} ${MAPPING_ROW_MIN_H} ${MAPPING_ROW_CELL_H} rounded-md py-0 pr-0.5 ${
          draggable ? 'cursor-grab active:cursor-grabbing' : ''
        } ${rowClassName}`}
        style={{
          ...(depthIndentPx > 0 ? { marginLeft: depthIndentPx } : undefined),
          ...rowStyle,
        }}
        draggable={draggable || undefined}
        onDragStart={draggable ? handleDragStart : undefined}
        onDragOver={onDragOver}
        onDragOverCapture={onDragOverCapture}
        onDrop={onDrop}
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
      >
        {showChevronSlot ? (
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: BACKEND_TREE_CHEVRON_SLOT_PX }}
          >
            {chevron}
          </div>
        ) : null}

        {showArrowSlot ? (
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: BACKEND_TREE_ARROW_SLOT_PX }}
          >
            {arrow}
          </div>
        ) : null}

        {labelLeading ? <div className="flex shrink-0 items-center">{labelLeading}</div> : null}

        <div
          className={`flex min-w-0 shrink items-center gap-0.5 truncate ${MAPPING_ROW_MIN_H} ${
            fixedTreeSlots ? 'max-w-[min(20rem,60vw)]' : 'max-w-[min(14rem,50vw)]'
          }`}
        >
          {label}
        </div>

        {labelSuffix ? <div className="flex shrink-0 items-center">{labelSuffix}</div> : null}

        {showValue ? (
          <div ref={valueAnchorRef} className={`relative flex shrink-0 items-center ${MAPPING_ROW_MIN_H}`}>
            {valueEditor}
          </div>
        ) : null}

        {afterEditor ? <div className="flex shrink-0 items-center">{afterEditor}</div> : null}

        {toolbar && showValue ? (
          <MappingParameterToolbarPortal
            anchorRef={valueAnchorRef}
            visible={toolbarHovered}
            onPointerHoverChange={setToolbarHovered}
          >
            {toolbar}
          </MappingParameterToolbarPortal>
        ) : null}
      </div>
      {trailing ? <div className="min-w-0">{trailing}</div> : null}
    </>
  );
}
