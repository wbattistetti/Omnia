import { useMemo, useRef } from 'react';
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
 * @returns Record<string, string> - Dictionary of translations { guid: text }
 */
export function useDDTTranslations(ddt: any | null | undefined, task?: any, version?: number): Record<string, string> {
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
  const translationsKeys = Object.keys(globalTranslations).sort().join(',');
  // ✅ FASE 2.3: Use version to force recalculation when store is populated
  const stableVersion = version ?? 0;

  return useMemo(() => {
    if (!ddt) {
      return {};
    }

    const guidsArray = extractGUIDsFromDDT(ddt);
    console.log('[useDDTTranslations] 🔍 GUIDs extracted from DDT', {
      ddtId: ddt?.id || ddt?._id || 'no-id',
      guidsCount: guidsArray.length,
      sampleGuids: guidsArray.slice(0, 5)
    });

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
            if (typeof localStorage !== 'undefined' && localStorage.getItem('debug.useDDTTranslations') === '1') {
              console.log('[useDDTTranslations] ⚠️ Invalid steps structure', { nodeId, steps, stepsType: typeof steps });
            }
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
    console.log('[useDDTTranslations] 🔍 Total GUIDs after task.steps extraction', {
      totalGuids: guids.length,
      fromDDT: guidsArray.length,
      fromTaskSteps: guids.length - guidsArray.length,
      sampleGuids: guids.slice(0, 10)
    });

    if (guids.length === 0) {
      console.warn('[useDDTTranslations] ⚠️ No GUIDs found, returning empty translations');
      return {};
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

    console.log('[useDDTTranslations] 📊 Translation lookup results', {
      requestedGuids: guids.length,
      foundTranslations: foundGuids.length,
      missingTranslations: missingGuids.length,
      globalTranslationsCount: Object.keys(globalTranslations).length,
      sampleFound: foundGuids.slice(0, 5),
      sampleMissing: missingGuids.slice(0, 5)
    });

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
      console.warn('[useDDTTranslations] ⚠️ Missing translations', {
        ddtId: ddt.id || ddt._id || 'undefined',
        ddtLabel: ddt.label || 'no-label',
        requestedGuids: guids.length,
        foundTranslations: foundGuids.length,
        missingGuids: missingGuids.length,
        missingGuidsList: missingGuids,
        totalTranslationsInContext: currentTranslationsCount,
        sampleMissing: missingGuids.slice(0, 10),
        // Debug info to understand why translations are missing
        debug: {
          hasGlobalTranslations: Object.keys(globalTranslations).length > 0,
          sampleGuids: guids.slice(0, 5),
          sampleFound: foundGuids.slice(0, 5),
        sampleMissing: missingGuids.slice(0, 5)
        }
      });

      // Update last logged state
      lastLoggedStateRef.current = {
        ddtId: currentDdtId,
        missingGuidsHash,
        totalGuids,
        translationsCount: currentTranslationsCount
      };
    }

    return translationsFromGlobal;
    // ✅ CRITICAL: Don't include ddt/task in deps - they change reference on every render
    // Use only stable keys: ddtId, taskStepsKeys, translationsKeys, version
    // ✅ FASE 2.3: Added version to force recalculation when store is populated
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ddtId, taskStepsKeys, translationsKeys, stableVersion]);
}

