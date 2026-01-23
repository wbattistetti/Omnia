// DDT Value Composition

import type { DDTState } from './ddtTypes';
import { getTaskSemantics } from '../../../utils/taskSemantics';

/**
 * Composes main data value from sub data values
 * ✅ Handles Atomic, CompositeData, and Collection
 * ✅ Uses referenceId from instance (not recalculated from template)
 *
 * @param data - Single data node or array of data nodes (for Collection)
 * @param state - DDT state with memory
 * @param ddtInstance - Optional full DDT instance (needed for Collection semantics)
 */
export function compositeMainValue(
  data: any,
  state: DDTState,
  ddtInstance?: any
): any {
  // ✅ For Collection: data is an array of data nodes
  // Check if we have ddtInstance to deduce semantics
  if (ddtInstance) {
    const semantics = getTaskSemantics(ddtInstance);

    if (semantics === 'Collection') {
      // ✅ Collection: return array of independent values (no composition)
      const dataList = Array.isArray(ddtInstance.data)
        ? ddtInstance.data
        : ddtInstance.data ? [ddtInstance.data] : [];

      return dataList.map((main: any) => {
        // ✅ Runtime: use referenceId from instance (not recalculated from template)
        const dataId = main.referenceId || main.id;
        return state.memory[dataId]?.value;
      });
    }
  }

  // ✅ For Atomic/CompositeData: data is a single object
  const subs = data.subData || [];

  if (subs.length === 0) {
    // ✅ Atomic: return its own value
    // ✅ Runtime: use referenceId from instance (not recalculated from template)
    const dataId = data.referenceId || data.id;
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


