// DDT Navigator - Entry point for hierarchical DDT navigation

import type { AssembledDDT } from '../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
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
 * Implements: FOR EACH maindata → Retrieve → FOR EACH sub → Retrieve → Composite
 *
 * @param options.useNewEngine - If true, uses new DDT engine. If false or undefined, reads from localStorage/env.
 */
export async function executeGetDataHierarchical(
  ddt: AssembledDDT,
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
    console.log('[DDTNavigator] ═══════════════════════════════════════════════════════');
    console.log('[DDTNavigator] 🆕 USING NEW ENGINE via adapter');
    console.log('[DDTNavigator] ═══════════════════════════════════════════════════════');
    console.log('[DDTNavigator] Using NEW engine via adapter', {
      ddtId: ddt.id,
      ddtLabel: ddt.label,
      source,
      fromOptions: options?.useNewEngine !== undefined,
      fromStorage: options?.useNewEngine === undefined
    });
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
  console.log('[DDTNavigator] ═══════════════════════════════════════════════════════');
  console.log('[DDTNavigator] 🔧 USING OLD ENGINE');
  console.log('[DDTNavigator] ═══════════════════════════════════════════════════════');
  console.log('[DDTNavigator] Using OLD engine', {
    ddtId: ddt.id,
    ddtLabel: ddt.label,
    source,
    fromOptions: options?.useNewEngine !== undefined,
    fromStorage: options?.useNewEngine === undefined,
    storageValue: (() => {
      try {
        return localStorage.getItem('ddt.useNewEngine');
      } catch {
        return 'N/A';
      }
    })()
  });
  return executeGetDataHierarchicalOld(ddt, state, callbacks);
}

/**
 * Old engine implementation (renamed from executeGetDataHierarchical)
 */
async function executeGetDataHierarchicalOld(
  ddt: AssembledDDT,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  console.log('[DDTNavigator] ═══════════════════════════════════════════════════════');
  console.log('[DDTNavigator] 🔧🔧🔧 OLD ENGINE ACTIVE 🔧🔧🔧');
  console.log('[DDTNavigator] ═══════════════════════════════════════════════════════');
  console.log('[DDTNavigator] Starting hierarchical navigation (OLD ENGINE)', {
    ddtId: ddt.id,
    ddtLabel: ddt.label,
    hasMainData: !!ddt.mainData,
    timestamp: new Date().toISOString()
  });

  // DDT can have mainData as array or single object
  let mainData = Array.isArray(ddt.mainData) ? ddt.mainData[0] : ddt.mainData;

  // If mainData is not found, try alternative structures
  if (!mainData) {
    // Try to find mainData in alternative locations
    if ((ddt as any).nodes && Array.isArray((ddt as any).nodes)) {
      // DDT might have nodes array instead of mainData
      mainData = (ddt as any).nodes[0];
    }
  }

  if (!mainData) {
    console.error('[DDTNavigator] DDT missing mainData', {
      ddtKeys: Object.keys(ddt),
      ddtId: ddt.id,
      ddtLabel: ddt.label,
      mainDataType: typeof ddt.mainData,
      isArray: Array.isArray(ddt.mainData),
      hasNodes: !!(ddt as any).nodes,
      nodesCount: (ddt as any).nodes?.length || 0
    });
    return {
      success: false,
      error: new Error('DDT missing mainData')
    };
  }

  // If mainData doesn't have id/label, try to get from DDT or generate
  if (!mainData.id) {
    mainData.id = mainData._id || ddt.id || `main_${Date.now()}`;
  }
  if (!mainData.label && !mainData.name) {
    mainData.label = ddt.label || 'Data';
  }

  console.log('[DDTNavigator] Retrieving mainData', {
    mainDataId: mainData.id,
    mainDataLabel: mainData.label || mainData.name,
    mainDataName: mainData.name,
    hasSubData: !!mainData.subData,
    subDataCount: mainData.subData?.length || 0,
    mainDataKeys: Object.keys(mainData),
    hasSteps: !!mainData.steps,
    stepsType: Array.isArray(mainData.steps) ? 'array' : typeof mainData.steps,
    mainDataStructure: JSON.stringify(mainData).substring(0, 500)
  });

  // Retrieve mainData
  // Pass DDT to callbacks so retrieve() can access it
  const mainResult = await retrieve(mainData, state, { ...callbacks, ddt });

  console.log('[DDTNavigator] MainData retrieve result', {
    success: mainResult.success,
    exit: mainResult.exit,
    hasValue: !!mainResult.value,
    error: mainResult.error?.message
  });

  // Check for exit action
  if (mainResult.exit) {
    return mainResult;
  }

  if (!mainResult.success) {
    return mainResult;
  }

  // Update state with main result
  state = {
    ...state,
    memory: {
      ...state.memory,
      [mainData.id]: { value: mainResult.value, confirmed: true }
    }
  };

  // FOR EACH subdatum WHERE mandatory not filled or attempts terminated
  const subDataList = mainData.subData || [];
  const requiredSubs = subDataList.filter((sub: any) => sub.required !== false);

  console.log('[DDTNavigator] Processing subData', {
    totalSubs: subDataList.length,
    requiredSubs: requiredSubs.length,
    subIds: requiredSubs.map((s: any) => ({ id: s.id, label: s.label }))
  });

  for (const subData of requiredSubs) {
    // Check if sub is already filled
    const isFilled = state.memory[subData.id]?.value !== undefined;

    console.log('[DDTNavigator] Checking subData', {
      subId: subData.id,
      subLabel: subData.label,
      isFilled
    });

    if (!isFilled) {
      console.log('[DDTNavigator] Retrieving subData', {
        subId: subData.id,
        subLabel: subData.label
      });

      // Retrieve subData
      const subResult = await retrieve(subData, state, callbacks);

      console.log('[DDTNavigator] SubData retrieve result', {
        subId: subData.id,
        success: subResult.success,
        exit: subResult.exit,
        hasValue: !!subResult.value
      });

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
          [subData.id]: { value: subResult.value, confirmed: true }
        }
      };
    }
  }

  // Composite mainData value from sub values
  const composedValue = compositeMainValue(mainData, state);
  state = {
    ...state,
    memory: {
      ...state.memory,
      [mainData.id]: { value: composedValue, confirmed: true }
    }
  };

  // MainData completed successfully
  return { success: true };
}

