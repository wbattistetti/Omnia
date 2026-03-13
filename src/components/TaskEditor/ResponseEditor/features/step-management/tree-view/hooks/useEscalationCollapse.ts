import { useState, useCallback } from 'react';

/**
 * Hook per gestire il collasso delle escalation
 * - Collasso normale: mostra solo primo task
 * - Collasso con Ctrl sulla prima escalation: nasconde/mostra altre escalation
 */
export function useEscalationCollapse() {
  const [collapsedEscalations, setCollapsedEscalations] = useState<Record<number, boolean>>({});
  const [hideOtherEscalations, setHideOtherEscalations] = useState(false);

  const toggleCollapse = useCallback((escalationIdx: number, ctrlKey: boolean) => {
    if (ctrlKey && escalationIdx === 0) {
      // Ctrl+click sulla prima escalation: toggle nascondi/mostra altre escalation
      setHideOtherEscalations(prev => !prev);
    } else {
      // Click normale: toggle collasso escalation (mostra solo primo task)
      setCollapsedEscalations(prev => ({
        ...prev,
        [escalationIdx]: !prev[escalationIdx]
      }));
    }
  }, []);

  const isCollapsed = useCallback((escalationIdx: number) => {
    return collapsedEscalations[escalationIdx] ?? false;
  }, [collapsedEscalations]);

  return {
    collapsedEscalations,
    hideOtherEscalations,
    toggleCollapse,
    isCollapsed
  };
}
