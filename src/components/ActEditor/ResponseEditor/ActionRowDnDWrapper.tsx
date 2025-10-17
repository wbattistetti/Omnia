import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Action } from './types';

export interface ActionRowDnDWrapperProps {
  escalationIdx: number;
  actionIdx: number;
  action: Action;
  onMoveAction: (fromEscIdx: number, fromActIdx: number, toEscIdx: number, toActIdx: number, position: 'before' | 'after') => void;
  onDropAction?: (from: { escalationIdx: number; actionIdx: number; action: Action }, to: { escalationIdx: number; actionIdx: number }, position: 'before' | 'after') => void;
  onDropNewAction?: (action: any, to: { escalationIdx: number; actionIdx: number }, position: 'before' | 'after') => void;
  children: React.ReactNode;
  allowViewerDrop?: boolean;
}

export const DND_TYPE = 'ACTION_ROW';
export const DND_TYPE_VIEWER = 'ACTION_VIEWER';

const ActionRowDnDWrapper: React.FC<ActionRowDnDWrapperProps> = ({
  escalationIdx,
  actionIdx,
  action,
  onMoveAction,
  onDropAction,
  onDropNewAction,
  children,
  allowViewerDrop = true,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = React.useState<'before' | 'after' | undefined>(undefined);
  const [canShowPreview, setCanShowPreview] = React.useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: () => {
      console.log('[DnD][ActionRow][begin]', { escalationIdx, actionIdx, label: action?.label || action?.actionId });
      return { type: DND_TYPE, escalationIdx, actionIdx, action };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      console.log('[DnD][ActionRow][end]', { didDrop: monitor.didDrop() });
    },
  });

  const accepts = React.useMemo(() => (allowViewerDrop ? [DND_TYPE, DND_TYPE_VIEWER] : [DND_TYPE]), [allowViewerDrop]);

  const [{ isOver }, drop] = useDrop({
    accept: accepts,
    hover: (item: any, monitor) => {
      if (!ref.current) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';

      let show = true;
      if (item.type === DND_TYPE) {
        if (item.escalationIdx === escalationIdx) {
          if (item.actionIdx === actionIdx) {
            show = false;
          } else if (position === 'before' && item.actionIdx === actionIdx - 1) {
            show = false;
          } else if (position === 'after' && item.actionIdx === actionIdx + 1) {
            show = false;
          }
        }
      } else if (item.type === DND_TYPE_VIEWER) {
        // sempre mostra preview per elemento nuovo
        show = true;
      }
      setPreviewPosition(show ? position : undefined);
      setCanShowPreview(show);
    },
    drop: (item: any, monitor) => {
      if (!ref.current) return;
      if (!canShowPreview || previewPosition === undefined) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';

      if (item.type === DND_TYPE) {
        if (item.escalationIdx === escalationIdx && item.actionIdx === actionIdx) return;
        console.log('[DnD drop:move]', 'from', item.escalationIdx, item.actionIdx, 'to', escalationIdx, actionIdx, position);
        if (onMoveAction) {
          console.log('[DnD][drop] Calling onMoveAction');
          onMoveAction(item.escalationIdx, item.actionIdx, escalationIdx, actionIdx, position);
        }
        if (onDropAction) {
          console.log('[DnD][drop] Calling onDropAction');
          onDropAction(item, { escalationIdx, actionIdx }, position);
        }
      } else if (allowViewerDrop && item.type === DND_TYPE_VIEWER) {
        console.log('[DnD drop:new]', item.label, '→', escalationIdx, actionIdx, position);
        if (onDropNewAction) {
          onDropNewAction(item.action, { escalationIdx, actionIdx }, position);
        } else {
          console.warn('[DnD][drop] onDropNewAction NOT PROVIDED!');
        }
      }
      setPreviewPosition(undefined);
      setCanShowPreview(false);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
    leave: () => { setPreviewPosition(undefined); setCanShowPreview(false); },
  });

  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1, position: 'relative' }}>
      {isOver && previewPosition && canShowPreview && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 3,
            background: '#2563eb',
            zIndex: 1000,
            pointerEvents: 'none',
            top: previewPosition === 'before' ? 0 : 'calc(100% - 2px)',
          }}
        />
      )}
      {children}
    </div>
  );
};

export default ActionRowDnDWrapper;
