import { useCallback } from 'react';
import { updateStepEscalations } from '@responseEditor/utils/stepHelpers';
import { canAddStep } from '../utils/stepOrderUtils';

interface UseStepActionsProps {
  node: any;
  stepKeys: string[];
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
}

/**
 * Hook per gestire le azioni sugli step (add/delete/disable)
 */
export function useStepActions({
  node,
  stepKeys,
  updateSelectedNode
}: UseStepActionsProps) {

  const addStep = useCallback((newStepKey: string) => {
    if (!canAddStep(newStepKey, stepKeys)) {
      return;
    }

    updateSelectedNode((node) => {
      // Crea step con escalation vuota
      return updateStepEscalations(node, newStepKey, () => [{ tasks: [] }]);
    });
  }, [stepKeys, updateSelectedNode]);

  const deleteStep = useCallback((stepKey: string) => {
    if (stepKey === 'start') {
      return; // Start non può essere eliminato
    }

    updateSelectedNode((node) => {
      const next = { ...node };

      if (Array.isArray(node.steps)) {
        next.steps = node.steps.filter((s: any) => {
          if (s?.type === stepKey) return false;
          if (s?.templateStepId) {
            const stepType = s.templateStepId.split(':').pop();
            return stepType !== stepKey;
          }
          return true;
        });
      } else if (node.steps && typeof node.steps === 'object') {
        next.steps = { ...node.steps };
        delete next.steps[stepKey];
      }

      return next;
    });
  }, [updateSelectedNode]);

  const addEscalation = useCallback((stepKey: string) => {
    updateSelectedNode((node) => {
      return updateStepEscalations(node, stepKey, (escalations) => {
        return [...escalations, { tasks: [] }];
      });
    });
  }, [updateSelectedNode]);

  const deleteEscalation = useCallback((stepKey: string, escalationIdx: number) => {
    updateSelectedNode((node) => {
      return updateStepEscalations(node, stepKey, (escalations) => {
        const updated = [...escalations];
        updated.splice(escalationIdx, 1);
        return updated.length > 0 ? updated : [{ tasks: [] }];
      });
    });
  }, [updateSelectedNode]);

  return {
    addStep,
    deleteStep,
    addEscalation,
    deleteEscalation
  };
}
