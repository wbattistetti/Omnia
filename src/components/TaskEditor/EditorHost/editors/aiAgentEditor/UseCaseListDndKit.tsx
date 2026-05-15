/**
 * Drag & drop lista use case AI Agent con @dnd-kit/core (PointerSensor + pointerWithin):
 * evita limiti di HTML5Backend su scroll/overflow/Dockview rispetto a react-dnd.
 *
 * Esporta lo shell `UseCaseListDndShell` (wrappa la `<ul>`), `UseCaseRowDnDWrapper`,
 * `UseCaseRowHeader` e `UseCaseDropSentinel` con la stessa API usata dal composer.
 */

import React from 'react';
import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  useDndContext,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';

const ROW_PREFIX = 'uc-row-';
const HDR_PREFIX = 'uc-hdr-';
const GAP_PREFIX = 'uc-gap-';
const TAIL_PREFIX = 'uc-tail-';

export type UseCaseRowDnDWrapperProps = {
  useCaseId: string;
  parentId: string | null;
  enabled: boolean;
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  children: React.ReactNode;
};

type InsertBeforeDropData = {
  kind: 'insertBefore';
  targetId: string;
  parentId: string | null;
};

type InsertAfterDropData = {
  kind: 'insertAfter';
  anchorId: string;
  parentId: string | null;
};

type RowDragData = {
  rowId: string;
  parentId: string | null;
};

const DROP_PREVIEW_LINE_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  background: '#2563eb',
  zIndex: 1000,
  pointerEvents: 'none',
};

type RowKitContextValue = {
  connectHeaderDrop: (el: HTMLDivElement | null) => void;
  showHeaderInsertLine: boolean;
};

const UseCaseRowKitContext = React.createContext<RowKitContextValue | null>(null);

/**
 * Header droppabile: preview linea sul bordo superiore (inserimento prima della riga).
 */
export function UseCaseRowHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(UseCaseRowKitContext);
  if (ctx == null) {
    throw new Error('UseCaseRowHeader must be used inside UseCaseRowDnDWrapper');
  }
  return (
    <div
      ref={ctx.connectHeaderDrop}
      className={[className, 'relative'].filter(Boolean).join(' ')}
      {...rest}
    >
      {ctx.showHeaderInsertLine ? (
        <div
          style={{
            ...DROP_PREVIEW_LINE_STYLE,
            zIndex: 10001,
            top: 0,
          }}
          aria-hidden
        />
      ) : null}
      {children}
    </div>
  );
}

export function UseCaseRowDnDWrapper({
  useCaseId,
  parentId,
  enabled,
  children,
}: UseCaseRowDnDWrapperProps) {
  const rowId = `${ROW_PREFIX}${useCaseId}`;
  const hdrId = `${HDR_PREFIX}${useCaseId}`;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: rowId,
    disabled: !enabled,
    data: { rowId: useCaseId, parentId: parentId ?? null } satisfies RowDragData,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: hdrId,
    disabled: !enabled,
    data: {
      kind: 'insertBefore',
      targetId: useCaseId,
      parentId: parentId ?? null,
    } satisfies InsertBeforeDropData,
  });

  const { active } = useDndContext();
  const dragPayload = active?.data.current as RowDragData | undefined;
  const showHeaderInsertLine = Boolean(
    enabled &&
      isOver &&
      dragPayload &&
      dragPayload.rowId !== useCaseId &&
      (dragPayload.parentId ?? null) === (parentId ?? null)
  );

  const connectHeaderDrop = React.useCallback(
    (node: HTMLDivElement | null) => {
      setDropRef(node);
    },
    [setDropRef]
  );

  const ctxValue = React.useMemo<RowKitContextValue>(
    () => ({
      connectHeaderDrop,
      showHeaderInsertLine,
    }),
    [connectHeaderDrop, showHeaderInsertLine]
  );

  return (
    <UseCaseRowKitContext.Provider value={ctxValue}>
      <div
        ref={setDragRef}
        {...listeners}
        {...attributes}
        className={enabled ? 'cursor-grab active:cursor-grabbing' : undefined}
        style={{
          opacity: isDragging ? 0.5 : 1,
          position: 'relative',
          userSelect: enabled ? 'none' : undefined,
          WebkitUserSelect: enabled ? 'none' : undefined,
          touchAction: enabled ? 'none' : undefined,
        }}
      >
        {children}
      </div>
    </UseCaseRowKitContext.Provider>
  );
}

export type UseCaseDropSentinelProps = {
  parentId: string | null;
  enabled: boolean;
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
} & (
  | { mode: 'insertBeforeNext'; insertBeforeId: string }
  | { mode: 'insertAfterAnchor'; insertAfterId: string }
);

const SENTINEL_LINE_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  top: '50%',
  transform: 'translateY(-50%)',
  background: '#2563eb',
  zIndex: 1000,
  pointerEvents: 'none',
};

export function UseCaseDropSentinel(props: UseCaseDropSentinelProps) {
  const { parentId, enabled, mode } = props;
  const droppableId =
    mode === 'insertBeforeNext'
      ? `${GAP_PREFIX}${props.insertBeforeId}`
      : `${TAIL_PREFIX}${props.insertAfterId}`;
  const dropData: InsertBeforeDropData | InsertAfterDropData =
    mode === 'insertBeforeNext'
      ? {
          kind: 'insertBefore',
          targetId: props.insertBeforeId,
          parentId: parentId ?? null,
        }
      : {
          kind: 'insertAfter',
          anchorId: props.insertAfterId,
          parentId: parentId ?? null,
        };

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: !enabled,
    data: dropData,
  });

  const { active } = useDndContext();
  const dragPayload = active?.data.current as RowDragData | undefined;
  const anchorForSameCheck =
    mode === 'insertBeforeNext' ? props.insertBeforeId : props.insertAfterId;
  const showLine = Boolean(
    enabled &&
      isOver &&
      dragPayload &&
      dragPayload.rowId !== anchorForSameCheck &&
      (dragPayload.parentId ?? null) === (parentId ?? null)
  );

  return (
    <div
      ref={setNodeRef}
      className="relative mx-1 box-border h-1 min-h-[4px] shrink-0 rounded-sm"
      aria-hidden
      style={{
        userSelect: enabled ? 'none' : undefined,
        WebkitUserSelect: enabled ? 'none' : undefined,
        touchAction: enabled ? 'none' : undefined,
      }}
    >
      {showLine ? <div style={{ ...SENTINEL_LINE_STYLE, zIndex: 10001 }} aria-hidden /> : null}
    </div>
  );
}

export type UseCaseListDndShellProps = {
  /** Quando false, onDragEnd non committa (es. busy / ricerca). I sensori restano montati. */
  reorderEnabled: boolean;
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  children: React.ReactNode;
};

export function UseCaseListDndShell({
  reorderEnabled,
  onReorder,
  children,
}: UseCaseListDndShellProps) {
  const onReorderRef = React.useRef(onReorder);
  onReorderRef.current = onReorder;
  const reorderEnabledRef = React.useRef(reorderEnabled);
  reorderEnabledRef.current = reorderEnabled;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  const onDragEnd = React.useCallback((event: DragEndEvent) => {
    if (!reorderEnabledRef.current) return;
    const { active, over } = event;
    if (!over) return;
    const row = active.data.current as RowDragData | undefined;
    if (!row?.rowId) return;
    const draggedId = row.rowId;
    const d = over.data.current as InsertBeforeDropData | InsertAfterDropData | undefined;
    if (!d || !('kind' in d)) return;
    if ((row.parentId ?? null) !== (d.parentId ?? null)) return;
    if (d.kind === 'insertBefore') {
      if (draggedId === d.targetId) return;
      onReorderRef.current(draggedId, d.targetId, 'before');
      return;
    }
    if (draggedId === d.anchorId) return;
    onReorderRef.current(draggedId, d.anchorId, 'after');
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragEnd={onDragEnd}
    >
      {children}
    </DndContext>
  );
}
