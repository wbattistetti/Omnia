import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { TaskReference } from './types';

export interface ActionRowDnDWrapperProps {
  escalationIdx: number;
  taskIdx: number; // ✅ Index of the task in the escalation
  task: TaskReference | any; // ✅ TaskReference object
  onMoveTask: (fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: 'before' | 'after') => void;
  onDropTask?: (from: { escalationIdx: number; taskIdx: number; task: TaskReference }, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => void;
  onDropNewTask?: (task: any, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => void;
  children: React.ReactNode;
  allowViewerDrop?: boolean;
  isEditing?: boolean; // Disable drag when editing
  // Legacy props for backward compatibility
  actionIdx?: number; // @deprecated Use taskIdx instead
  action?: TaskReference | any; // @deprecated Use task instead
  onMoveAction?: (fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: 'before' | 'after') => void; // @deprecated Use onMoveTask instead
  onDropAction?: (from: { escalationIdx: number; taskIdx: number; task: TaskReference }, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => void; // @deprecated Use onDropTask instead
  onDropNewAction?: (task: any, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => void; // @deprecated Use onDropNewTask instead
}

export const DND_TYPE = 'ACTION_ROW';
export const DND_TYPE_VIEWER = 'ACTION_VIEWER';

const ActionRowDnDWrapper: React.FC<ActionRowDnDWrapperProps> = ({
  escalationIdx,
  taskIdx: taskIdxProp,
  task: taskProp,
  onMoveTask: onMoveTaskProp,
  onDropTask: onDropTaskProp,
  onDropNewTask: onDropNewTaskProp,
  children,
  allowViewerDrop = true,
  isEditing = false,
  // Legacy props for backward compatibility
  actionIdx,
  action,
  onMoveAction,
  onDropAction,
  onDropNewAction,
}) => {
  // Use new props if provided, otherwise fall back to legacy props
  const taskIdx = taskIdxProp ?? actionIdx ?? 0;
  const task = taskProp ?? action;
  const onMoveTask = onMoveTaskProp ?? onMoveAction;
  const onDropTask = onDropTaskProp ?? onDropAction;
  const onDropNewTask = onDropNewTaskProp ?? onDropNewAction;
  const ref = React.useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = React.useState<'before' | 'after' | undefined>(undefined);
  const [canShowPreview, setCanShowPreview] = React.useState(false);

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: () => {
      return { type: DND_TYPE, escalationIdx, taskIdx, task, actionIdx: taskIdx, action: task }; // Include both for backward compatibility
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
    },
    canDrag: !isEditing, // Disable drag when editing
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
          const itemTaskIdx = item.taskIdx ?? item.actionIdx;
          if (itemTaskIdx === taskIdx) {
            show = false;
          } else if (position === 'before' && itemTaskIdx === taskIdx - 1) {
            show = false;
          } else if (position === 'after' && itemTaskIdx === taskIdx + 1) {
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
      const debugDrop = () => {
        try { return localStorage.getItem('debug.drop') === '1'; } catch { return false; }
      };

      if (debugDrop()) {
        console.log('[DROP_DEBUG][ActionRowDnDWrapper] 🎬 Drop handler called', {
          hasRef: !!ref.current,
          canShowPreview,
          previewPosition,
          itemType: item?.type
        });
      }

      if (!ref.current) {
        if (debugDrop()) console.warn('[DROP_DEBUG] No ref.current');
        return undefined;
      }

      // For DND_TYPE_VIEWER, we don't need canShowPreview check - always allow drop
      if (item.type === DND_TYPE_VIEWER) {
        // Calculate position based on current mouse position
        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          if (debugDrop()) console.warn('[DROP_DEBUG] No clientOffset');
          return undefined;
        }
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;
        const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';

        if (debugDrop()) {
          console.log('[DROP_DEBUG][ActionRowDnDWrapper] 🎯 Processing DND_TYPE_VIEWER drop', {
            escalationIdx,
            taskIdx,
            position
          });
        }

        if (onDropNewTask) {
          onDropNewTask(item, { escalationIdx, taskIdx }, position);
          setPreviewPosition(undefined);
          setCanShowPreview(false);
          return { handled: true };
        } else {
          if (debugDrop()) console.warn('[DROP_DEBUG] onDropNewTask NOT PROVIDED!');
          return undefined;
        }
      }

      // For DND_TYPE (internal reordering), use the existing logic
      if (!canShowPreview || previewPosition === undefined) {
        if (debugDrop()) console.warn('[DROP_DEBUG] canShowPreview false or previewPosition undefined');
        return undefined;
      }

      // For DND_TYPE (internal reordering), calculate position and handle
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return undefined;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      const position: 'before' | 'after' = hoverClientY < hoverMiddleY ? 'before' : 'after';

      let handled = false;

      if (item.type === DND_TYPE) {
        const itemTaskIdx = item.taskIdx ?? item.actionIdx;
        if (item.escalationIdx === escalationIdx && itemTaskIdx === taskIdx) {
          setPreviewPosition(undefined);
          setCanShowPreview(false);
          return undefined; // Not handled (same position)
        }
        if (onMoveTask) {
          onMoveTask(item.escalationIdx, itemTaskIdx, escalationIdx, taskIdx, position);
          handled = true;
        }
        if (onDropTask) {
          onDropTask(item, { escalationIdx, taskIdx }, position);
          handled = true;
        }
      }

      setPreviewPosition(undefined);
      setCanShowPreview(false);

      // Return a value to signal that this drop was handled (for monitor.didDrop() in parent)
      // This prevents CanvasDropWrapper from also handling the same drop
      return handled ? { handled: true } : undefined;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  drag(drop(ref));

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : 1, position: 'relative' }}>
      {/* Preview line - thin blue line shown when hovering */}
      {isOver && previewPosition && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: '#2563eb',
            zIndex: 1000,
            pointerEvents: 'none',
            top: previewPosition === 'before' ? 0 : 'calc(100% - 2px)',
          }}
        />
      )}
      {React.cloneElement(children as React.ReactElement, { isDragging })}
    </div>
  );
};

export default ActionRowDnDWrapper;
