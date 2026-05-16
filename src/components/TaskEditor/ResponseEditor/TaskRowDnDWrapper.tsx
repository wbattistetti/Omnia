import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { TaskReference } from './types';

export interface TaskRowDnDWrapperProps {
  escalationIdx: number;
  taskIdx: number; // Index of the task in the escalation
  task: TaskReference | any; // TaskReference object
  onMoveTask: (fromEscIdx: number, fromTaskIdx: number, toEscIdx: number, toTaskIdx: number, position: 'before' | 'after') => void;
  onDropTask?: (from: { escalationIdx: number; taskIdx: number; task: TaskReference }, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => void;
  onDropNewTask?: (task: any, to: { escalationIdx: number; taskIdx: number }, position: 'before' | 'after') => void;
  children: React.ReactNode;
  allowViewerDrop?: boolean;
  isEditing?: boolean; // Disable drag when editing
}

export const DND_TYPE = 'TASK_ROW';
export const DND_TYPE_VIEWER = 'TASK_VIEWER';

function resolveDropPosition(
  node: HTMLDivElement,
  monitor: { getClientOffset(): { x: number; y: number } | null }
): 'before' | 'after' | undefined {
  const clientOffset = monitor.getClientOffset();
  if (!clientOffset) return undefined;
  const rect = node.getBoundingClientRect();
  const hoverMiddleY = (rect.bottom - rect.top) / 2;
  const hoverClientY = clientOffset.y - rect.top;
  return hoverClientY < hoverMiddleY ? 'before' : 'after';
}

function shouldShowRowPreview(
  item: { type?: string; escalationIdx?: number; taskIdx?: number },
  escalationIdx: number,
  taskIdx: number,
  position: 'before' | 'after'
): boolean {
  if (item.type === DND_TYPE_VIEWER) return true;
  if (item.type !== DND_TYPE) return false;
  if (item.escalationIdx !== escalationIdx) return true;
  const itemTaskIdx = item.taskIdx ?? -1;
  if (itemTaskIdx === taskIdx) return false;
  if (position === 'before' && itemTaskIdx === taskIdx - 1) return false;
  if (position === 'after' && itemTaskIdx === taskIdx + 1) return false;
  return true;
}

const TaskRowDnDWrapper: React.FC<TaskRowDnDWrapperProps> = ({
  escalationIdx,
  taskIdx,
  task,
  onMoveTask,
  onDropTask,
  onDropNewTask,
  children,
  allowViewerDrop = true,
  isEditing = false,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [previewPosition, setPreviewPosition] = React.useState<'before' | 'after' | undefined>(undefined);
  const onMoveTaskRef = React.useRef(onMoveTask);
  const onDropNewTaskRef = React.useRef(onDropNewTask);
  onMoveTaskRef.current = onMoveTask;
  onDropNewTaskRef.current = onDropNewTask;

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: () => {
      return { type: DND_TYPE, escalationIdx, taskIdx, task };
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
      const position = resolveDropPosition(ref.current, monitor);
      if (!position) return;
      const show = shouldShowRowPreview(item, escalationIdx, taskIdx, position);
      setPreviewPosition(show ? position : undefined);
    },
    drop: (item: any, monitor) => {
      if (monitor.didDrop()) {
        return undefined;
      }

      const node = ref.current;
      if (!node) return undefined;

      const position = resolveDropPosition(node, monitor);
      if (!position) return undefined;

      if (item.type === DND_TYPE_VIEWER) {
        if (onDropNewTaskRef.current) {
          onDropNewTaskRef.current(item, { escalationIdx, taskIdx }, position);
          setPreviewPosition(undefined);
          return { handled: true };
        }
        return undefined;
      }

      if (item.type !== DND_TYPE) {
        return undefined;
      }

      if (!shouldShowRowPreview(item, escalationIdx, taskIdx, position)) {
        setPreviewPosition(undefined);
        return undefined;
      }

      const itemTaskIdx = item.taskIdx;
      if (item.escalationIdx === escalationIdx && itemTaskIdx === taskIdx) {
        setPreviewPosition(undefined);
        return undefined;
      }

      let handled = false;
      if (onMoveTaskRef.current) {
        onMoveTaskRef.current(item.escalationIdx, itemTaskIdx, escalationIdx, taskIdx, position);
        handled = true;
      }
      if (onDropTask) {
        onDropTask(item, { escalationIdx, taskIdx }, position);
        handled = true;
      }

      setPreviewPosition(undefined);
      return handled ? { handled: true } : undefined;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      data-escalation-index={escalationIdx} // ✅ NEW: Add data attribute for scroll targeting
      data-task-index={taskIdx} // ✅ NEW: Add data attribute for scroll targeting
      style={{ opacity: isDragging ? 0.5 : 1, position: 'relative' }}
    >
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

export default TaskRowDnDWrapper;

