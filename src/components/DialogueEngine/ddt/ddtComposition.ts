// DDT Value Composition

import type { DDTState } from './ddtTypes';

/**
 * Composes main data value from sub data values
 */
export function compositeMainValue(
  mainData: any,
  state: DDTState
): any {
  const subs = mainData.subData || [];

  if (subs.length === 0) {
    // Atomic main: return its own value
    return state.memory[mainData.id]?.value;
  }

  // Composite main: compose from sub values
  const composed: Record<string, any> = {};
  for (const sub of subs) {
    const subValue = state.memory[sub.id]?.value;
    if (subValue !== undefined) {
      composed[sub.id] = subValue;
    }
  }

  return composed;
}


