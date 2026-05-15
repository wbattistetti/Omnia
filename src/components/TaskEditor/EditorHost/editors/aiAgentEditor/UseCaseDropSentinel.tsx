/**
 * Fascia droppabile compatta tra due righe use case (stesso parent_id), sostituisce il drop
 * sull’`<ul>` per i gap tra elementi lista senza target sulla lista intera.
 */

import React from 'react';
import { useDrop } from 'react-dnd';
import {
  AI_AGENT_USE_CASE_ROW_DND_TYPE,
  type AIAgentUseCaseRowDragItem,
} from './UseCaseRowDnDWrapper';

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

export type UseCaseDropSentinelProps = {
  /** Id della riga sotto il gap: il drop equivale a inserire prima di questo use case. */
  insertBeforeId: string;
  parentId: string | null;
  enabled: boolean;
  onReorder: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
};

export function UseCaseDropSentinel({
  insertBeforeId,
  parentId,
  enabled,
  onReorder,
}: UseCaseDropSentinelProps) {
  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const onReorderRef = React.useRef(onReorder);
  onReorderRef.current = onReorder;
  const [showLine, setShowLine] = React.useState(false);

  const clearLine = React.useCallback(() => setShowLine(false), []);

  const [{ isOver }, drop] = useDrop<
    AIAgentUseCaseRowDragItem,
    { handled: boolean } | undefined,
    { isOver: boolean }
  >({
    accept: AI_AGENT_USE_CASE_ROW_DND_TYPE,
    hover(item, monitor) {
      if (!enabled) {
        clearLine();
        return;
      }
      const el = nodeRef.current;
      if (!el) {
        clearLine();
        return;
      }
      if (item.id === insertBeforeId) {
        clearLine();
        return;
      }
      if ((item.parentId ?? null) !== (parentId ?? null)) {
        clearLine();
        return;
      }
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        clearLine();
        return;
      }
      const r = el.getBoundingClientRect();
      const inside =
        clientOffset.x >= r.left &&
        clientOffset.x <= r.right &&
        clientOffset.y >= r.top &&
        clientOffset.y <= r.bottom;
      setShowLine(inside);
    },
    drop(item, monitor) {
      clearLine();
      if (!enabled || monitor.didDrop()) return undefined;
      if (item.id === insertBeforeId) return undefined;
      if ((item.parentId ?? null) !== (parentId ?? null)) return undefined;
      onReorderRef.current(item.id, insertBeforeId, 'before');
      return { handled: true };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  const setSentinelRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      drop(node);
    },
    [drop]
  );

  return (
    <div
      ref={setSentinelRef}
      className="relative mx-1 box-border h-1 min-h-[4px] shrink-0 rounded-sm"
      aria-hidden
      style={{
        userSelect: enabled ? 'none' : undefined,
        WebkitUserSelect: enabled ? 'none' : undefined,
        touchAction: enabled ? 'none' : undefined,
      }}
    >
      {isOver && showLine ? (
        <div style={{ ...SENTINEL_LINE_STYLE, zIndex: 10001 }} aria-hidden />
      ) : null}
    </div>
  );
}
