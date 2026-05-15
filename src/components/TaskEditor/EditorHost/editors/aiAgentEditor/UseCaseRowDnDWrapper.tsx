/**
 * Riordino use case AI Agent con react-dnd: drag sull’intera card, drop e midpoint solo
 * sull’header (UseCaseRowHeader), linea preview #2563eb. Ghost nascosto con getEmptyImage
 * come TaskPalette/TaskItem per hit-test stabile sotto Dockview/overflow.
 */

import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';

export const AI_AGENT_USE_CASE_ROW_DND_TYPE = 'AI_AGENT_USE_CASE_ROW' as const;

export type AIAgentUseCaseRowDragItem = {
  type: typeof AI_AGENT_USE_CASE_ROW_DND_TYPE;
  id: string;
  parentId: string | null;
};

export type UseCaseRowDnDWrapperProps = {
  useCaseId: string;
  parentId: string | null;
  /** false durante busy, ricerca wizard o edit titolo sulla riga. */
  enabled: boolean;
  /** Callback di commit (stessa semantica di applySiblingReorderForPersist / dock). */
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  children: React.ReactNode;
};

/** Stile linea preview allineato a TaskRowDnDWrapper (ResponseEditor). */
const DROP_PREVIEW_LINE_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 2,
  background: '#2563eb',
  zIndex: 1000,
  pointerEvents: 'none',
};

type RowDnDContextValue = {
  connectHeaderDrop: (el: HTMLDivElement | null) => void;
  headerInsertPreview: 'before' | 'after' | null;
  isOverHeader: boolean;
};

const UseCaseRowDnDContext = React.createContext<RowDnDContextValue | null>(null);

/**
 * Header droppabile: ref del drop target e preview sul solo bounding box dell’header
 * (mai sul corpo accordion).
 */
export function UseCaseRowHeader({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(UseCaseRowDnDContext);
  if (ctx == null) {
    throw new Error('UseCaseRowHeader must be used inside UseCaseRowDnDWrapper');
  }
  const showLine = ctx.isOverHeader && ctx.headerInsertPreview != null;
  return (
    <div
      ref={ctx.connectHeaderDrop}
      className={[className, 'relative'].filter(Boolean).join(' ')}
      {...rest}
    >
      {showLine ? (
        <div
          style={{
            ...DROP_PREVIEW_LINE_STYLE,
            zIndex: 10001,
            top: ctx.headerInsertPreview === 'before' ? 0 : undefined,
            bottom: ctx.headerInsertPreview === 'after' ? 0 : undefined,
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
  onReorder,
  children,
}: UseCaseRowDnDWrapperProps) {
  const headerDropNodeRef = React.useRef<HTMLDivElement | null>(null);
  const [headerInsertPreview, setHeaderInsertPreview] = React.useState<'before' | 'after' | null>(
    null
  );
  const onReorderRef = React.useRef(onReorder);
  onReorderRef.current = onReorder;

  const clearHeaderPreview = React.useCallback(() => {
    setHeaderInsertPreview(null);
  }, []);

  const [{ isDragging }, drag, dragPreview] = useDrag<
    AIAgentUseCaseRowDragItem,
    void,
    { isDragging: boolean }
  >({
    type: AI_AGENT_USE_CASE_ROW_DND_TYPE,
    item: () => ({
      type: AI_AGENT_USE_CASE_ROW_DND_TYPE,
      id: useCaseId,
      parentId: parentId ?? null,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      clearHeaderPreview();
    },
    canDrag: enabled,
  });

  React.useEffect(() => {
    dragPreview(getEmptyImage(), { captureDraggingState: true });
  }, [dragPreview]);

  const [{ isOverHeader }, drop] = useDrop<
    AIAgentUseCaseRowDragItem,
    { handled: boolean } | undefined,
    { isOverHeader: boolean }
  >({
    accept: AI_AGENT_USE_CASE_ROW_DND_TYPE,
    hover(item, monitor) {
      if (!enabled) {
        clearHeaderPreview();
        return;
      }
      const headerEl = headerDropNodeRef.current;
      if (!headerEl) {
        clearHeaderPreview();
        return;
      }
      if (item.id === useCaseId) {
        clearHeaderPreview();
        return;
      }
      if ((item.parentId ?? null) !== (parentId ?? null)) {
        clearHeaderPreview();
        return;
      }
      const rect = headerEl.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        clearHeaderPreview();
        return;
      }
      const hoverMiddleY = (rect.bottom - rect.top) / 2;
      const hoverClientY = clientOffset.y - rect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';
      setHeaderInsertPreview(position);
    },
    drop(item, monitor) {
      clearHeaderPreview();
      if (!enabled) return undefined;
      if (monitor.didDrop()) return undefined;
      const headerEl = headerDropNodeRef.current;
      if (!headerEl) return undefined;
      if (item.id === useCaseId) return undefined;
      if ((item.parentId ?? null) !== (parentId ?? null)) return undefined;
      const rect = headerEl.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return undefined;
      const hoverMiddleY = (rect.bottom - rect.top) / 2;
      const hoverClientY = clientOffset.y - rect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';
      onReorderRef.current(item.id, useCaseId, position);
      return { handled: true };
    },
    collect: (monitor) => ({
      isOverHeader: monitor.isOver(),
    }),
  });

  const connectHeaderDrop = React.useCallback(
    (node: HTMLDivElement | null) => {
      headerDropNodeRef.current = node;
      drop(node);
    },
    [drop]
  );

  const connectCardDrag = React.useCallback(
    (node: HTMLDivElement | null) => {
      drag(node);
    },
    [drag]
  );

  const ctxValue = React.useMemo<RowDnDContextValue>(
    () => ({
      connectHeaderDrop,
      headerInsertPreview,
      isOverHeader,
    }),
    [connectHeaderDrop, headerInsertPreview, isOverHeader]
  );

  return (
    <UseCaseRowDnDContext.Provider value={ctxValue}>
      <div
        ref={connectCardDrag}
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
    </UseCaseRowDnDContext.Provider>
  );
}
