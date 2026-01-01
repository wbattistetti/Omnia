import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TaskMeta } from './types'; // ✅ RINOMINATO: ActMeta → TaskMeta


type Ctx = {
  task?: TaskMeta; // ✅ RINOMINATO: act → task
  open: (task: TaskMeta) => void; // ✅ RINOMINATO: act → task
  close: () => void;
};

const TaskEditorContext = createContext<Ctx | null>(null);

export function useTaskEditor() {
  const ctx = useContext(TaskEditorContext);
  if (!ctx) throw new Error('useTaskEditor must be used within TaskEditorProvider');
  return ctx;
}

export function TaskEditorProvider({ children }: { children: React.ReactNode }) {
  const [task, setTask] = useState<TaskMeta | undefined>();
  useEffect(() => {
  }, []);
  const open = (t: TaskMeta) => {
    setTask(t);
  };
  const close = () => {
    setTask(undefined);
  };
  return (
    <TaskEditorContext.Provider value={{ task, open, close }}>{children}</TaskEditorContext.Provider>
  );
}


