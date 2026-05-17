/**
 * Invisible append target after the last task row: no idle chrome, blue line on hover only.
 */

import React, { useSyncExternalStore } from 'react';
import { useDrop } from 'react-dnd';
import { DND_TYPE_VIEWER } from '@responseEditor/TaskRowDnDWrapper';
import {
  getPaletteTaskDragActive,
  subscribePaletteTaskDrag,
} from '@responseEditor/paletteTaskDragBridge';

const PREVIEW_LINE_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  height: 2,
  background: '#2563eb',
  zIndex: 1000,
  pointerEvents: 'none',
};

export type TaskSequenceAppendDropZoneProps = {
  onAppend: (incoming: unknown) => void;
};

export function TaskSequenceAppendDropZone({
  onAppend,
}: TaskSequenceAppendDropZoneProps): React.ReactElement {
  const onAppendRef = React.useRef(onAppend);
  onAppendRef.current = onAppend;

  const paletteDragActive = useSyncExternalStore(
    subscribePaletteTaskDrag,
    getPaletteTaskDragActive,
    () => false
  );

  const [{ isOver, isPaletteDrag }, drop] = useDrop({
    accept: [DND_TYPE_VIEWER],
    drop: (item: unknown, monitor) => {
      if (monitor.didDrop()) return undefined;
      onAppendRef.current(item);
      return { handled: true };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      isPaletteDrag: monitor.getItemType() === DND_TYPE_VIEWER,
    }),
  });

  return (
    <div
      ref={drop}
      aria-hidden
      style={{
        position: 'relative',
        height: paletteDragActive || isPaletteDrag ? 36 : 12,
        marginTop: 0,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: 6,
        boxSizing: 'border-box',
      }}
    >
      {isOver && isPaletteDrag ? <div style={PREVIEW_LINE_STYLE} /> : null}
    </div>
  );
}

