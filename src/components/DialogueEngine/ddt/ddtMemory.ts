// DDT Memory Management

import type { DDTState } from './ddtTypes';

/**
 * Saves a value to DDT memory
 */
export function saveToMemory(
  state: DDTState,
  nodeId: string,
  value: any,
  confirmed: boolean = false
): DDTState {
  return {
    ...state,
    memory: {
      ...state.memory,
      [nodeId]: { value, confirmed }
    }
  };
}

/**
 * Checks if a sub is filled (has valid value)
 */
export function isSubFilled(state: DDTState, subId: string): boolean {
  const entry = state.memory[subId];
  if (!entry) return false;

  const value = entry.value;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim().length === 0) return false;

  return true;
}

/**
 * Finds the first missing required sub for a mainData
 */
export function findMissingRequiredSub(
  mainData: any,
  state: DDTState
): string | undefined {
  const subs = mainData.subData || [];
  const requiredSubs = subs.filter((sub: any) => sub.required !== false);

  for (const sub of requiredSubs) {
    if (!isSubFilled(state, sub.id)) {
      return sub.id;
    }
  }

  return undefined;
}

/**
 * Checks if all required subs of a mainData are filled
 */
export function isAllRequiredSubsFilled(
  mainData: any,
  state: DDTState
): boolean {
  return findMissingRequiredSub(mainData, state) === undefined;
}


