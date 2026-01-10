// DDT Value Composition

import type { DDTState } from './ddtTypes';
import { getTaskSemantics } from '../../../utils/taskSemantics';

/**
 * Composes main data value from sub data values
 * ✅ Handles Atomic, CompositeData, and Collection
 * ✅ Uses referenceId from instance (not recalculated from template)
 *
 * @param mainData - Single mainData node or array of mainData nodes (for Collection)
 * @param state - DDT state with memory
 * @param ddtInstance - Optional full DDT instance (needed for Collection semantics)
 */
export function compositeMainValue(
  mainData: any,
  state: DDTState,
  ddtInstance?: any
): any {
  // ✅ For Collection: mainData is an array of mainData nodes
  // Check if we have ddtInstance to deduce semantics
  if (ddtInstance) {
    const semantics = getTaskSemantics(ddtInstance);

    if (semantics === 'Collection') {
      // ✅ Collection: return array of independent values (no composition)
      const mainDataList = Array.isArray(ddtInstance.mainData)
        ? ddtInstance.mainData
        : ddtInstance.mainData ? [ddtInstance.mainData] : [];

      return mainDataList.map((main: any) => {
        // ✅ Runtime: use referenceId from instance (not recalculated from template)
        const dataId = main.referenceId || main.id;
        return state.memory[dataId]?.value;
      });
    }
  }

  // ✅ For Atomic/CompositeData: mainData is a single object
  const subs = mainData.subData || [];

  if (subs.length === 0) {
    // ✅ Atomic: return its own value
    // ✅ Runtime: use referenceId from instance (not recalculated from template)
    const dataId = mainData.referenceId || mainData.id;
    return state.memory[dataId]?.value;
  }

  // ✅ CompositeData: compose from sub values
  const composed: Record<string, any> = {};
  for (const sub of subs) {
    // ✅ Runtime: use referenceId from instance (not recalculated from template)
    const subDataId = sub.referenceId || sub.id;
    const subValue = state.memory[subDataId]?.value;
    if (subValue !== undefined) {
      // ✅ Use referenceId as key (not local id)
      composed[subDataId] = subValue;
    }
  }

  return composed;
}


