import { useCallback } from 'react';
import { updateStepEscalations } from '@responseEditor/utils/stepHelpers';

type UpdateSelectedNodeFn = (updater: (node: any) => any, notifyProvider?: boolean) => void;

/**
 * Hook per gestire l'update di una singola escalation
 */
export function useEscalationUpdate(
  updateSelectedNode: UpdateSelectedNodeFn,
  stepKey: string,
  escalationIdx: number
) {
  const updateEscalation = useCallback(
    (updater: (escalation: any) => any) => {
      updateSelectedNode((node) => {
        return updateStepEscalations(node, stepKey, (escalations) => {
          const updated = [...escalations];
          updated[escalationIdx] = updater(updated[escalationIdx] || { tasks: [] });
          return updated;
        });
      });
    },
    [updateSelectedNode, stepKey, escalationIdx]
  );

  return { updateEscalation };
}
