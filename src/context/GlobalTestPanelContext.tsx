// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Task, TaskTree } from '@types/taskTypes';

export type TestPanelContext =
  | { type: 'task'; task: Task; taskTree: TaskTree; projectId: string; translations?: Record<string, string> }
  | { type: 'flowchart'; nodeId: string; nodeRows: any[] }
  | null;

interface GlobalTestPanelContextValue {
  isOpen: boolean;
  context: TestPanelContext;
  openWithTask: (task: Task, taskTree: TaskTree, projectId: string, translations?: Record<string, string>) => void;
  openWithFlowchart: (nodeId: string, nodeRows: any[]) => void;
  close: () => void;
}

const GlobalTestPanelContext = createContext<GlobalTestPanelContextValue | undefined>(undefined);

export function GlobalTestPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState<TestPanelContext>(null);

  const openWithTask = useCallback((
    task: Task,
    taskTree: TaskTree,
    projectId: string,
    translations?: Record<string, string>
  ) => {
    setContext({ type: 'task', task, taskTree, projectId, translations });
    setIsOpen(true);
  }, []);

  const openWithFlowchart = useCallback((nodeId: string, nodeRows: any[]) => {
    setContext({ type: 'flowchart', nodeId, nodeRows });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setContext(null);
  }, []);

  return (
    <GlobalTestPanelContext.Provider value={{ isOpen, context, openWithTask, openWithFlowchart, close }}>
      {children}
    </GlobalTestPanelContext.Provider>
  );
}

export function useGlobalTestPanel() {
  const context = useContext(GlobalTestPanelContext);
  if (!context) {
    throw new Error('useGlobalTestPanel must be used within GlobalTestPanelProvider');
  }
  return context;
}
