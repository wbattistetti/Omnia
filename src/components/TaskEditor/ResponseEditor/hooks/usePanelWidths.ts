// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useRightPanelWidth } from '../RightPanel';

export interface UsePanelWidthsResult {
  rightWidth: number;
  setRightWidth: (width: number) => void;
  testPanelWidth: number;
  setTestPanelWidth: (width: number) => void;
  tasksPanelWidth: number;
  setTasksPanelWidth: (width: number) => void;
}

/**
 * Hook that manages panel widths for ResponseEditor.
 */
export function usePanelWidths(): UsePanelWidthsResult {
  const { width: rightWidth, setWidth: setRightWidth } = useRightPanelWidth(360);
  const { width: testPanelWidth, setWidth: setTestPanelWidth } = useRightPanelWidth(360, 'responseEditor.testPanelWidth');
  const { width: tasksPanelWidth, setWidth: setTasksPanelWidth } = useRightPanelWidth(360, 'responseEditor.tasksPanelWidth');

  return {
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
  };
}
