import React from 'react';
import { useDrag, useDrop } from 'react-dnd';

export interface ActionRowDnDWrapperProps {
  escalationIdx: number;
  actionIdx: number;
  action: any;
  onMoveAction: (fromEscIdx: number, fromActIdx: number, toEscIdx: number, toActIdx: number, position: 'before' | 'after') => void;
  onDropAction?: (from: { escalationIdx: number; actionIdx: number; action: any }, to: { escalationIdx: number; actionIdx: number }, position: 'before' | 'after') => void;
  children: React.ReactNode;
}

export const DND_TYPE = 'ACTION_ROW';

const ActionRowDnDWrapper: React.FC<ActionRowDnDWrapperProps> = ({
  escalationIdx,
  actionIdx,
  action,
  onMoveAction,
  onDropAction,
  children,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = React.useState<'before' | 'after' | undefined>(undefined);
  const [canShowPreview, setCanShowPreview] = React.useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: { escalationIdx, actionIdx, action },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_TYPE,
    hover: (item: any, monitor) => {
      if (!ref.current) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';
      // Regola UX: mostra preview solo se il drop cambierebbe la posizione
      let show = true;
      if (item.escalationIdx === escalationIdx) {
        if (item.actionIdx === actionIdx) {
          // Stessa riga: mai preview
          show = false;
        } else if (position === 'before' && item.actionIdx === actionIdx - 1) {
          // Bottom della riga sopra = top di questa: no preview
          show = false;
        } else if (position === 'after' && item.actionIdx === actionIdx + 1) {
          // Top della riga sotto = bottom di questa: no preview
          show = false;
        }
      }
      setPreviewPosition(show ? position : undefined);
      setCanShowPreview(show);
    },
    drop: (item: any, monitor) => {
      if (!ref.current) return;
      if (!canShowPreview || previewPosition === undefined) return;
      if (item.escalationIdx === escalationIdx && item.actionIdx === actionIdx) return;
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';
      if (onMoveAction) {
        onMoveAction(item.escalationIdx, item.actionIdx, escalationIdx, actionIdx, position);
      }
      if (onDropAction) {
        onDropAction(item, { escalationIdx, actionIdx }, position);
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
      {/* Preview line */}
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
