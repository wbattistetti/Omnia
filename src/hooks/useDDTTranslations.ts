import { useMemo, useRef, useEffect } from 'react';
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { extractGUIDsFromDDT } from '../utils/ddtUtils';

/**
 * Hook to load translations for a DDT from the global translation table.
 * Extracts GUIDs from the DDT and returns filtered translations.
 *
 * This hook:
 * 1. Extracts all GUIDs (translation keys) from the DDT structure
 * 2. Also extracts GUIDs from task.steps[nodeId] if task is provided (unified model)
 * 3. Loads translations from the global translation table (already filtered by project locale)
 * 4. Returns a flat dictionary of { guid: text } for the current project locale
 *
 * @param ddt - The DDT object to extract translations for
 * @param task - Optional Task object to extract GUIDs from task.steps[nodeId]
 * @param version - Optional version number to force recalculation when it changes
 * @param selectedNodeId - Optional selected node ID to force recalculation when node selection changes
 * @returns Record<string, string> - Dictionary of translations { guid: text }
 */
export function useDDTTranslations(
  ddt: any | null | undefined,
  task?: any,
  version?: number,
  selectedNodeId?: string | null
): Record<string, string> {
  const { translations: globalTranslations } = useProjectTranslations();

  // Track last logged state to avoid duplicate logs - use stable keys
  const lastLoggedStateRef = useRef<{
    ddtId?: string;
    missingGuidsHash?: string;
    totalGuids?: number;
    translationsCount?: number;
  }>({});

  // Use stable dependencies: serialize ddt id, task steps, and translations keys
  const ddtId = ddt?.id || ddt?._id || null;
  // ✅ NUOVO: Gestisce sia array che dictionary per retrocompatibilità
  const taskStepsKeys = task?.steps
    ? (Array.isArray(task.steps)
        ? `array:${task.steps.length}`
        : Object.keys(task.steps).sort().join(','))
    : '';

  // ✅ FASE 2 FIX: Create hash of translation VALUES (not just keys) to detect when translations are overwritten
  // This is critical: when adaptation overwrites translations (same GUID, different text),
  // the keys don't change, but the values do. We need to detect value changes.
  const translationsHash = useMemo(() => {
    if (!ddt || !globalTranslations || Object.keys(globalTranslations).length === 0) {
      return '';
    }

    // Extract all GUIDs from DDT and task.steps
    const guidsArray = extractGUIDsFromDDT(ddt);
    const guidsSet = new Set(guidsArray);

    // Also extract GUIDs from task.steps if available
    if (task?.steps) {
      if (Array.isArray(task.steps)) {
        task.steps.forEach((step: any) => {
          if (step?.escalations && Array.isArray(step.escalations)) {
            step.escalations.forEach((esc: any) => {
              if (esc?.tasks && Array.isArray(esc.tasks)) {
                esc.tasks.forEach((taskItem: any) => {
                  const textParam = taskItem.parameters?.find((p: any) => p?.parameterId === 'text');
                  if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                    guidsSet.add(textParam.value);
                  }
                });
              }
            });
          }
        });
      } else {
        Object.entries(task.steps).forEach(([nodeId, steps]: [string, any]) => {
          if (!steps || typeof steps !== 'object') return;
          const stepEntries = Array.isArray(steps)
            ? steps.map((s: any, idx: number) => [`step_${idx}`, s])
            : Object.entries(steps);
          stepEntries.forEach(([stepKey, step]: [string, any]) => {
            if (step?.escalations) {
              step.escalations.forEach((esc: any) => {
                if (esc?.tasks) {
                  esc.tasks.forEach((taskItem: any) => {
                    const textParam = taskItem.parameters?.find((p: any) => p?.parameterId === 'text');
                    if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                      guidsSet.add(textParam.value);
                    }
                  });
                }
              });
            }
          });
        });
      }
    }

    // Create hash from GUID + text pairs for relevant GUIDs only
    const relevantEntries = Array.from(guidsSet)
      .filter(guid => globalTranslations[guid]) // Only include GUIDs that have translations
      .sort()
      .map(guid => `${guid}:${globalTranslations[guid]}`)
      .join('|');

    return relevantEntries;
  }, [ddt, task?.steps, globalTranslations]);

  // ✅ FASE 2.3: Use version to force recalculation when store is populated
  const stableVersion = version ?? 0;
  // ✅ CRITICAL FIX: Include selectedNodeId to force recalculation when node selection changes
  // When you change node, the context changes, so translations must be recalculated
  const stableSelectedNodeId = selectedNodeId ?? null;

  // ✅ CRITICAL FIX: Add translationsCount as dependency to force recalculation when translations are loaded
  // This ensures the useMemo recalculates even if translationsHash remains empty (when GUIDs aren't yet in globalTranslations)
  const translationsCount = Object.keys(globalTranslations).length;

  // ✅ DEBUG: Log when translationsCount changes
  const prevTranslationsCountRef = useRef<number>(0);
  useEffect(() => {
    if (translationsCount !== prevTranslationsCountRef.current) {
      console.log('[useDDTTranslations] 🔄 translationsCount changed', {
        previous: prevTranslationsCountRef.current,
        current: translationsCount,
        ddtId: ddt?.id || ddt?._id
      });
      prevTranslationsCountRef.current = translationsCount;
    }
  }, [translationsCount, ddt?.id, ddt?._id]);

  return useMemo(() => {
    // ✅ DEBUG: Log when useMemo recalculates
    console.log('[useDDTTranslations] 🔄 useMemo recalculating', {
      ddtId: ddt?.id || ddt?._id,
      translationsCount,
      translationsHashLength: translationsHash.length,
      hasGlobalTranslations: !!globalTranslations,
      globalTranslationsCount: Object.keys(globalTranslations).length
    });

    if (!ddt) {
      return {};
    }

    const guidsArray = extractGUIDsFromDDT(ddt);
    const guidsSet = new Set(guidsArray);

    // ✅ Also extract GUIDs from task.steps (unified model)
    // ✅ NUOVO: Gestisce sia array MaterializedStep[] che dictionary legacy
    if (task?.steps) {
      const taskStepsGuids: string[] = [];

      if (Array.isArray(task.steps)) {
        // ✅ NUOVO MODELLO: Array MaterializedStep[]
        // Ogni step è un MaterializedStep con escalations
        task.steps.forEach((step: any) => {
          if (step?.escalations && Array.isArray(step.escalations)) {
            step.escalations.forEach((esc: any) => {
              if (esc?.tasks && Array.isArray(esc.tasks)) {
                esc.tasks.forEach((taskItem: any) => {
                  // Extract text parameter GUID
                  const textParam = taskItem.parameters?.find((p: any) => p?.parameterId === 'text');
                  if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                    guidsSet.add(textParam.value);
                    taskStepsGuids.push(textParam.value);
                  }
                });
              }
            });
          }
        });
      } else {
        // ✅ RETROCOMPATIBILITÀ: Dictionary format { [nodeId]: steps }
        Object.entries(task.steps).forEach(([nodeId, steps]: [string, any]) => {
          if (!steps || typeof steps !== 'object') {
            return;
          }

          // steps can be an array or an object with step keys
          const stepEntries = Array.isArray(steps)
            ? steps.map((s: any, idx: number) => [`step_${idx}`, s])
            : Object.entries(steps);

          stepEntries.forEach(([stepKey, step]: [string, any]) => {
            if (step?.escalations) {
              step.escalations.forEach((esc: any) => {
                if (esc?.tasks) {
                  esc.tasks.forEach((taskItem: any) => {
                    // Extract text parameter GUID
                    const textParam = taskItem.parameters?.find((p: any) => p?.parameterId === 'text');
                    if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                      guidsSet.add(textParam.value);
                      taskStepsGuids.push(textParam.value);
                    }
                  });
                }
              });
            }
          });
        });
      }

      if (typeof localStorage !== 'undefined' && localStorage.getItem('debug.useDDTTranslations') === '1' && taskStepsGuids.length > 0) {
        // Log rimosso: non essenziale per flusso motore
      }
    }

    const guids = Array.from(guidsSet);

    if (guids.length === 0) {
      return {};
    }

    // ✅ DEBUG: Log extraction details
    const globalTranslationsCount = Object.keys(globalTranslations).length;
    if (globalTranslationsCount === 0) {
      console.warn('[useDDTTranslations] ⚠️ globalTranslations is empty', {
        ddtId: ddt?.id || ddt?._id,
        guidsCount: guids.length,
        sampleGuids: guids.slice(0, 5)
      });
    }

    // Extract translations from global table (already filtered by project locale)
    const translationsFromGlobal: Record<string, string> = {};
    const foundGuids: string[] = [];
    const missingGuids: string[] = [];

    guids.forEach(guid => {
      const translation = globalTranslations[guid];
      if (translation) {
        translationsFromGlobal[guid] = translation;
        foundGuids.push(guid);
      } else {
        missingGuids.push(guid);
      }
    });

    // ✅ DEBUG: Log if translations are missing
    if (missingGuids.length > 0 && globalTranslationsCount > 0) {
      console.warn('[useDDTTranslations] ⚠️ Some GUIDs not found in globalTranslations', {
        ddtId: ddt?.id || ddt?._id,
        totalGuids: guids.length,
        foundCount: foundGuids.length,
        missingCount: missingGuids.length,
        globalTranslationsCount,
        sampleMissingGuids: missingGuids.slice(0, 5),
        sampleFoundGuids: foundGuids.slice(0, 5),
        sampleGlobalGuids: Object.keys(globalTranslations).slice(0, 5)
      });
    }


    // 🔍 DEBUG: Log sempre (non solo se mancano traduzioni)
    if (typeof localStorage !== 'undefined' && localStorage.getItem('debug.useDDTTranslations') === '1') {
      // Log rimosso: non essenziale per flusso motore
    }

    // ✅ Log warning only if state actually changed (not just reference change)
    const currentDdtId = ddt.id || ddt._id || 'no-id';
    const missingGuidsHash = missingGuids.length > 0
      ? missingGuids.sort().join(',')
      : '';
    const totalGuids = guids.length;
    const currentTranslationsCount = Object.keys(globalTranslations).length;

    const lastState = lastLoggedStateRef.current;
    const hasStateChanged =
      lastState.ddtId !== currentDdtId ||
      lastState.missingGuidsHash !== missingGuidsHash ||
      lastState.totalGuids !== totalGuids ||
      lastState.translationsCount !== currentTranslationsCount;

    if (missingGuids.length > 0 && hasStateChanged) {
      // Missing translations detected

      // Update last logged state
      lastLoggedStateRef.current = {
        ddtId: currentDdtId,
        missingGuidsHash,
        totalGuids,
        translationsCount: currentTranslationsCount
      };
    }

    // ✅ DEBUG: Log final result
    const finalCount = Object.keys(translationsFromGlobal).length;
    if (finalCount === 0 && guids.length > 0 && translationsCount > 0) {
      console.error('[useDDTTranslations] ❌ ERROR: GUIDs extracted but no translations found', {
        ddtId: ddt?.id || ddt?._id,
        extractedGuidsCount: guids.length,
        globalTranslationsCount: translationsCount,
        sampleExtractedGuids: guids.slice(0, 5),
        sampleGlobalGuids: Object.keys(globalTranslations).slice(0, 5),
        missingGuidsCount: missingGuids.length,
        sampleMissingGuids: missingGuids.slice(0, 5)
      });
    }

    return translationsFromGlobal;
    // ✅ CRITICAL: Don't include ddt/task in deps - they change reference on every render
    // Use only stable keys: ddtId, taskStepsKeys, translationsHash, version, selectedNodeId, translationsCount
    // ✅ FASE 2 FIX: Use translationsHash (includes values) instead of translationsKeys (only keys)
    // This allows detection of translation overwrites during adaptation (same GUID, different text)
    // ✅ FASE 2.3: Added version to force recalculation when store is populated
    // ✅ CRITICAL FIX: Added selectedNodeId to force recalculation when node selection changes
    // ✅ CRITICAL FIX: Added translationsCount to force recalculation when translations are loaded/updated
    // ✅ CRITICAL FIX: Added globalTranslations to dependencies to ensure recalculation when translations are loaded
    // This ensures recalculation when globalTranslations is populated, even if translationsCount hasn't updated yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ddtId, taskStepsKeys, translationsHash, stableVersion, stableSelectedNodeId, translationsCount, globalTranslations]);
}

