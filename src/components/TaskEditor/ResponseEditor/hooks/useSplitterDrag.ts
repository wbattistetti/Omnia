// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useEffect } from 'react';

export interface UseSplitterDragParams {
  draggingPanel: 'left' | 'test' | 'tasks' | 'shared' | null;
  setDraggingPanel: React.Dispatch<React.SetStateAction<'left' | 'test' | 'tasks' | 'shared' | null>>;
  rightWidth: number;
  setRightWidth: (width: number) => void;
  testPanelWidth: number;
  setTestPanelWidth: (width: number) => void;
  tasksPanelWidth: number;
  setTasksPanelWidth: (width: number) => void;
  tasksPanelMode: string;
  testPanelMode: string;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;
}

/**
 * Hook that handles splitter drag interactions for all panels.
 */
export function useSplitterDrag(params: UseSplitterDragParams) {
  const {
    draggingPanel,
    setDraggingPanel,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
    tasksPanelMode,
    testPanelMode,
    tasksStartWidthRef,
    tasksStartXRef,
  } = params;

  useEffect(() => {
    if (!draggingPanel) return;

    const onMove = (e: MouseEvent) => {
      const total = window.innerWidth;
      const minWidth = 160;
      const leftMin = 320;

      if (draggingPanel === 'left') {
        const maxRight = Math.max(minWidth, total - leftMin);
        const newWidth = Math.max(minWidth, Math.min(maxRight, total - e.clientX));
        setRightWidth(newWidth);
      } else if (draggingPanel === 'test') {
        const contentLeft = total - (rightWidth || 360);
        if (tasksPanelMode === 'actions' && tasksPanelWidth > 1) {
          const maxTestWidth = total - contentLeft - tasksPanelWidth;
          const newTestWidth = Math.max(minWidth, Math.min(maxTestWidth, e.clientX - contentLeft));
          setTestPanelWidth(newTestWidth);
        } else {
          const maxRight = Math.max(minWidth, total - leftMin);
          const newWidth = Math.max(minWidth, Math.min(maxRight, total - e.clientX));
          setTestPanelWidth(newWidth);
        }
      } else if (draggingPanel === 'tasks') {
        const deltaX = tasksStartXRef.current - e.clientX;
        const newWidth = tasksStartWidthRef.current + deltaX;

        if (testPanelMode === 'chat' && testPanelWidth > 1) {
          const contentLeft = total - (rightWidth || 360);
          const maxTasksWidth = total - contentLeft - testPanelWidth;
          const clampedWidth = Math.max(minWidth, Math.min(maxTasksWidth, newWidth));
          setTasksPanelWidth(clampedWidth);
        } else {
          const maxTasksWidth = total - (rightWidth || 360) - 320;
          const clampedWidth = Math.max(minWidth, Math.min(maxTasksWidth, newWidth));
          setTasksPanelWidth(clampedWidth);
        }
      }
    };

    const onUp = () => setDraggingPanel(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPanel, setRightWidth, setTestPanelWidth, setTasksPanelWidth, rightWidth, tasksPanelWidth, tasksPanelMode, testPanelMode, testPanelWidth, tasksStartWidthRef, tasksStartXRef, setDraggingPanel]);
}
