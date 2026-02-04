// DDT Navigator - Entry point for hierarchical DDT navigation

import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { DDTState, RetrieveResult, DDTNavigatorCallbacks } from './ddtTypes';
import { retrieve } from './ddtRetrieve';
import { findMissingRequiredSub, isAllRequiredSubsFilled } from './ddtMemory';
import { compositeMainValue } from './ddtComposition';
import { executeGetDataHierarchicalWithFallback } from './ddtEngineAdapter';

/**
 * Reads useNewEngine flag from localStorage or environment variable
 */
function getUseNewEngineFromStorage(): boolean {
  try {
    // First check localStorage (set by UI toggle)
    const fromStorage = localStorage.getItem('ddt.useNewEngine');
    if (fromStorage !== null) {
      return fromStorage === 'true';
    }
    // Fallback to environment variable (Vite uses import.meta.env)
    return (import.meta.env.VITE_USE_NEW_DDT_ENGINE === 'true') || false;
  } catch {
    // Fallback to environment variable if localStorage not available
    return (import.meta.env.VITE_USE_NEW_DDT_ENGINE === 'true') || false;
  }
}

/**
 * Executes GetData task using hierarchical DDT navigation
 * Implements: FOR EACH data → Retrieve → FOR EACH sub → Retrieve → Composite
 *
 * @param options.useNewEngine - If true, uses new DDT engine. If false or undefined, reads from localStorage/env.
 */
export async function executeGetDataHierarchical(
  ddt: AssembledTaskTree,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks,
  options?: { useNewEngine?: boolean }
): Promise<RetrieveResult> {
  // ✅ FIX: Read from localStorage if options not passed
  const useNew = options?.useNewEngine ?? getUseNewEngineFromStorage();

  // Log which source was used
  const source = options?.useNewEngine !== undefined
    ? 'options parameter'
    : 'localStorage/env';

  if (useNew) {
    // Removed verbose logging
    // Usa nuovo engine tramite adapter con fallback automatico
    return executeGetDataHierarchicalWithFallback(
      ddt,
      state,
      callbacks,
      async () => {
        // Fallback: vecchio engine
        return executeGetDataHierarchicalOld(ddt, state, callbacks);
      }
    );
  }

  // Vecchio engine (comportamento predefinito)
  // Removed verbose logging
  return executeGetDataHierarchicalOld(ddt, state, callbacks);
}

/**
 * Old engine implementation (renamed from executeGetDataHierarchical)
 */
async function executeGetDataHierarchicalOld(
  ddt: AssembledTaskTree,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  // Removed verbose logging

  // DDT can have data as array or single object
  let data = Array.isArray(ddt.data) ? ddt.data[0] : ddt.data;

  // If data is not found, try alternative structures
  if (!data) {
    // Try to find data in alternative locations
    if ((ddt as any).nodes && Array.isArray((ddt as any).nodes)) {
      // DDT might have nodes array instead of data
      data = (ddt as any).nodes[0];
    }
  }

  if (!data) {
    console.error('[DDTNavigator] DDT missing data', {
      ddtKeys: Object.keys(ddt),
      ddtId: ddt.id,
      ddtLabel: ddt.label,
      dataType: typeof ddt.data,
      isArray: Array.isArray(ddt.data),
      hasNodes: !!(ddt as any).nodes,
      nodesCount: (ddt as any).nodes?.length || 0
    });
    return {
      success: false,
      error: new Error('DDT missing data')
    };
  }

  // If data doesn't have id/label, try to get from DDT or generate
  if (!data.id) {
    data.id = data._id || ddt.id || `main_${Date.now()}`;
  }
  if (!data.label && !data.name) {
    data.label = ddt.label || 'Data';
  }

  // Removed verbose logging

  // Retrieve data
  // Pass DDT to callbacks so retrieve() can access it
  const mainResult = await retrieve(data, state, { ...callbacks, ddt });

  // Removed verbose logging

  // Check for exit action
  if (mainResult.exit) {
    return mainResult;
  }

  if (!mainResult.success) {
    return mainResult;
  }

  // Update state with main result
  // ✅ Runtime: use referenceId from instance (not recalculated from template)
  const dataId = (data as any).referenceId || data.id;
  state = {
    ...state,
    memory: {
      ...state.memory,
      [dataId]: { value: mainResult.value, confirmed: true }
    }
  };

  // FOR EACH subdatum WHERE mandatory not filled or attempts terminated
  const subDataList = data.subData || [];
  const requiredSubs = subDataList.filter((sub: any) => sub.required !== false);

  // Removed verbose logging

  for (const subData of requiredSubs) {
    // ✅ Runtime: use referenceId from instance (not recalculated from template)
    const subDataId = (subData as any).referenceId || subData.id;
    // Check if sub is already filled
    const isFilled = state.memory[subDataId]?.value !== undefined;

    if (!isFilled) {
      // Removed verbose logging

      // Retrieve subData
      const subResult = await retrieve(subData, state, callbacks);

      // Removed verbose logging

      // Check for exit action
      if (subResult.exit) {
        return subResult;
      }

      if (!subResult.success) {
        // Continue with next sub or handle error
        continue;
      }

      // Update state with sub result
      state = {
        ...state,
        memory: {
          ...state.memory,
          [subDataId]: { value: subResult.value, confirmed: true }
        }
      };
    }
  }

  // Composite data value from sub values
  // ✅ Pass ddt for Collection semantics
  const composedValue = compositeMainValue(data, state, ddt);
  // ✅ Runtime: use referenceId from instance (not recalculated from template)
  const dataId = (data as any).referenceId || data.id;
  state = {
    ...state,
    memory: {
      ...state.memory,
      [dataId]: { value: composedValue, confirmed: true }
    }
  };

  // data completed successfully
  return { success: true };
}

