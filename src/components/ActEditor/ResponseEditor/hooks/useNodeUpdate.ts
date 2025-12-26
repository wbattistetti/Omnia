import { useCallback, useRef, useEffect } from 'react';
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
  // Use ref to track pending DDT updates to avoid calling replaceSelectedDDT during render
  const pendingDDTRef = useRef<{ ddt: any; notify: boolean } | null>(null);

  // Effect to persist DDT changes after render
  useEffect(() => {
    if (pendingDDTRef.current) {
      const { ddt, notify } = pendingDDTRef.current;
      pendingDDTRef.current = null;
      if (notify) {
        try {
          replaceSelectedDDT(ddt);
        } catch { }
      }
    }
  }, [localDDT, replaceSelectedDDT]);

  const updateSelectedNode = useCallback((
    updater: (node: any) => any,
    notifyProvider: boolean = true
  ) => {
    setLocalDDT((prev: any) => {
      if (!prev) return prev;

      // If root is selected, update introduction
      if (selectedRoot) {
        // Shallow copy only what we need
        const introStep = prev.introduction
          ? { type: 'introduction', escalations: prev.introduction.escalations }
          : { type: 'introduction', escalations: [] };
        const nodeForUpdate = { ...prev, steps: [introStep] };
        const updated = updater(nodeForUpdate) || nodeForUpdate;

        // Check if introduction actually changed
        const newIntroStep = updated?.steps?.find((s: any) => s.type === 'introduction');
        const hasActions = newIntroStep?.escalations?.some((esc: any) =>
              esc?.actions && Array.isArray(esc.actions) && esc.actions.length > 0
            );
        const introChanged = JSON.stringify(prev.introduction) !== JSON.stringify(newIntroStep?.escalations);

        if (!introChanged) return prev; // No change, return same reference

        // Only create new DDT if introduction changed
        const next = { ...prev };
            if (hasActions) {
              next.introduction = {
                type: 'introduction',
            escalations: newIntroStep.escalations || []
              };
            } else {
              delete next.introduction;
            }
        pendingDDTRef.current = { ddt: next, notify: notifyProvider };
        return next;
      }

      // Normal update for main/sub nodes - use shallow copy for efficiency
      const mains = getMainDataList(prev);
      const main = mains[selectedMainIndex];
      if (!main) return prev;

      if (selectedSubIndex == null) {
        // Main node update
        const before = JSON.stringify(main);
        const updated = updater(main) || main;
        const after = JSON.stringify(updated);
        if (before === after) return prev; // no content change

        // Shallow copy: only copy mainData array and the specific main node
        const newMainData = [...mains];
        newMainData[selectedMainIndex] = updated;
        const next = { ...prev, mainData: newMainData };
        pendingDDTRef.current = { ddt: next, notify: notifyProvider };
        return next;
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

        // Shallow copy: only copy what's necessary
        const newSubData = [...(main.subData || [])];
        newSubData[subIdx] = updated;
        const newMain = { ...main, subData: newSubData };
        const newMainData = [...mains];
        newMainData[selectedMainIndex] = newMain;
        const next = { ...prev, mainData: newMainData };
        pendingDDTRef.current = { ddt: next, notify: notifyProvider };
        return next;
      }
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

