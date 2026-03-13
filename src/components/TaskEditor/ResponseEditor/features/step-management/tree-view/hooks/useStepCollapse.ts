import { useState, useCallback } from 'react';

export interface StepCollapseState {
  [stepKey: string]: boolean;
}

/**
 * Hook per gestire lo stato di collasso/espansione degli step
 */
export function useStepCollapse(stepKeys: string[]) {
  const [collapsed, setCollapsed] = useState<StepCollapseState>(() => {
    // Default: tutti espansi
    const state: StepCollapseState = {};
    stepKeys.forEach(key => {
      state[key] = false; // false = espanso
    });
    return state;
  });

  const toggleCollapse = useCallback((stepKey: string) => {
    setCollapsed(prev => ({
      ...prev,
      [stepKey]: !prev[stepKey]
    }));
  }, []);

  const isCollapsed = useCallback((stepKey: string) => {
    return collapsed[stepKey] ?? false;
  }, [collapsed]);

  const expandAll = useCallback(() => {
    const state: StepCollapseState = {};
    stepKeys.forEach(key => {
      state[key] = false;
    });
    setCollapsed(state);
  }, [stepKeys]);

  const collapseAll = useCallback(() => {
    const state: StepCollapseState = {};
    stepKeys.forEach(key => {
      state[key] = true;
    });
    setCollapsed(state);
  }, [stepKeys]);

  return {
    collapsed,
    toggleCollapse,
    isCollapsed,
    expandAll,
    collapseAll
  };
}
