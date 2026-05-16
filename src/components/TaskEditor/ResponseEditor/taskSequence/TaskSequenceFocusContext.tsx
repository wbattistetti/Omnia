/**
 * Local parameter focus for TaskSequenceEditor when BehaviourUiProvider is absent
 * (e.g. AI Agent use case response). Mirrors BehaviourUi focus shape for ParameterFieldHost.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { BehaviourFocusTarget } from '@responseEditor/behaviour/BehaviourUiContext';

export type TaskSequenceFocusContextValue = {
  focusedParameter: BehaviourFocusTarget | null;
  requestFocusParameter: (target: BehaviourFocusTarget) => void;
  consumeFocusParameter: (target: BehaviourFocusTarget) => void;
};

const TaskSequenceFocusContext = createContext<TaskSequenceFocusContextValue | null>(null);

export function TaskSequenceFocusProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [focusedParameter, setFocusedParameter] = useState<BehaviourFocusTarget | null>(null);

  const requestFocusParameter = useCallback((target: BehaviourFocusTarget) => {
    setFocusedParameter(target);
  }, []);

  const consumeFocusParameter = useCallback((target: BehaviourFocusTarget) => {
    setFocusedParameter((prev) => {
      if (
        prev?.kind === 'parameter' &&
        target.kind === 'parameter' &&
        prev.escalationIdx === target.escalationIdx &&
        prev.taskIdx === target.taskIdx &&
        prev.parameterId === target.parameterId
      ) {
        return null;
      }
      return prev;
    });
  }, []);

  const value = useMemo(
    () => ({ focusedParameter, requestFocusParameter, consumeFocusParameter }),
    [focusedParameter, requestFocusParameter, consumeFocusParameter]
  );

  return (
    <TaskSequenceFocusContext.Provider value={value}>{children}</TaskSequenceFocusContext.Provider>
  );
}

export function useTaskSequenceFocus(): TaskSequenceFocusContextValue {
  const ctx = useContext(TaskSequenceFocusContext);
  if (!ctx) {
    throw new Error('useTaskSequenceFocus must be used within TaskSequenceFocusProvider');
  }
  return ctx;
}

export function useTaskSequenceFocusOptional(): TaskSequenceFocusContextValue | null {
  return useContext(TaskSequenceFocusContext);
}
