import { useCallback } from 'react';
import { getMainDataList, getSubDataList } from '../ddtSelectors';

/**
 * Hook for updating selected nodes in ResponseEditor.
 * Handles root (introduction), main data, and sub-data updates.
 *
 * @param localDDT - Current DDT state
 * @param setLocalDDT - State setter for DDT
 * @param selectedRoot - Whether root/aggregate is selected
 * @param selectedMainIndex - Current main data index
 * @param selectedSubIndex - Current sub-data index (undefined if main is selected)
 * @param replaceSelectedDDT - Function to persist DDT changes
 * @returns updateSelectedNode function
 */
export function useNodeUpdate(
  localDDT: any,
  setLocalDDT: React.Dispatch<React.SetStateAction<any>>,
  selectedRoot: boolean,
  selectedMainIndex: number,
  selectedSubIndex: number | undefined,
  replaceSelectedDDT: (ddt: any) => void
) {
  const updateSelectedNode = useCallback((
    updater: (node: any) => any,
    notifyProvider: boolean = true
  ) => {
    setLocalDDT((prev: any) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));

      // If root is selected, update introduction
      if (selectedRoot) {
        // Build a node structure with introduction step for updater
        const introStep = prev.introduction
          ? { type: 'introduction', escalations: prev.introduction.escalations }
          : { type: 'introduction', escalations: [] };
        const nodeForUpdate = { ...prev, steps: [introStep] };
        const updated = updater(nodeForUpdate) || nodeForUpdate;

        // Extract introduction from updated steps
        if (updated && updated.steps && Array.isArray(updated.steps)) {
          const updatedIntroStep = updated.steps.find((s: any) => s.type === 'introduction');
          if (updatedIntroStep && updatedIntroStep.escalations && updatedIntroStep.escalations.length > 0) {
            // Check if there are any actions in escalations
            const hasActions = updatedIntroStep.escalations.some((esc: any) =>
              esc?.actions && Array.isArray(esc.actions) && esc.actions.length > 0
            );
            if (hasActions) {
              next.introduction = {
                type: 'introduction',
                escalations: updatedIntroStep.escalations || []
              };
            } else {
              delete next.introduction;
            }
          } else {
            delete next.introduction;
          }
        } else {
          // If steps structure is missing, check if introduction was directly modified
          if (updated.introduction) {
            next.introduction = updated.introduction;
          } else if (!prev.introduction && updated.introduction === undefined) {
            delete next.introduction;
          }
        }
        if (notifyProvider) {
          try { replaceSelectedDDT(next); } catch { }
        }
        return next;
      }

      // Normal update for main/sub nodes
      const mains = getMainDataList(next);
      const main = mains[selectedMainIndex];
      if (!main) return prev;
      const beforeKind = selectedSubIndex == null ? main?.kind : getSubDataList(main)[selectedSubIndex]?.kind;

      if (selectedSubIndex == null) {
        // Main node update
        const before = JSON.stringify(main);
        const updated = updater(main) || main;
        const after = JSON.stringify(updated);
        if (before === after) return prev; // no content change
        mains[selectedMainIndex] = updated;
      } else {
        // Sub node update
        const subList = getSubDataList(main);
        const sub = subList[selectedSubIndex];
        if (!sub) return prev;
        const subIdx = (main.subData || []).findIndex((s: any) => s.label === sub.label);
        const before = JSON.stringify(main.subData[subIdx]);

        const updated = updater(sub) || sub;
        const after = JSON.stringify(updated);

        if (before === after) return prev; // no content change
        main.subData[subIdx] = updated;
      }

      next.mainData = mains;

      // Log kind changes
      try {
        const afterMain = mains[selectedMainIndex];
        const afterKind = selectedSubIndex == null ? afterMain?.kind : getSubDataList(afterMain)[selectedSubIndex]?.kind;
        // Log kind changes (if needed, can use info from logger)
        // info('RESPONSE_EDITOR', 'updateSelectedNode', { ... });
        try {
          const mainsKinds = (getMainDataList(next) || []).map((m: any) => ({
            label: m?.label,
            kind: m?.kind,
            manual: (m as any)?._kindManual
          }));
          console.log('[KindPersist][ResponseEditor][updateSelectedNode->replaceSelectedDDT]', mainsKinds);
        } catch { }
      } catch { }

      if (notifyProvider) {
        try { replaceSelectedDDT(next); } catch { }
      }
      return next;
    });
  }, [
    localDDT,
    selectedRoot,
    selectedMainIndex,
    selectedSubIndex,
    replaceSelectedDDT
  ]);

  return { updateSelectedNode };
}

