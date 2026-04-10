import { useMemo, useRef, useEffect } from 'react';
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { extractGUIDsFromDDT } from '../utils/ddtUtils';
import { translationKeyFromStoredValue } from '../utils/translationKeys';

/**
 * Collects translation store keys referenced by the DDT tree and by materialized task.steps.
 */
function collectTranslationGuidSet(ddt: any, task: any): Set<string> {
  const guidsArray = extractGUIDsFromDDT(ddt);
  const guidsSet = new Set(guidsArray);

  if (task?.steps) {
    if (Array.isArray(task.steps)) {
      task.steps.forEach((step: any) => {
        if (step?.escalations && Array.isArray(step.escalations)) {
          step.escalations.forEach((esc: any) => {
            if (esc?.tasks && Array.isArray(esc.tasks)) {
              esc.tasks.forEach((taskItem: any) => {
                const textParam = taskItem.parameters?.find((p: any) => p?.parameterId === 'text');
                const tk = textParam?.value ? translationKeyFromStoredValue(String(textParam.value)) : null;
                if (tk) {
                  guidsSet.add(tk);
                }
              });
            }
          });
        }
      });
    } else {
      Object.entries(task.steps).forEach(([, steps]: [string, any]) => {
        if (!steps || typeof steps !== 'object') return;
        const stepEntries = Array.isArray(steps)
          ? steps.map((s: any, idx: number) => [`step_${idx}`, s])
          : Object.entries(steps);
        stepEntries.forEach(([, step]: [string, any]) => {
          if (step?.escalations) {
            step.escalations.forEach((esc: any) => {
              if (esc?.tasks) {
                esc.tasks.forEach((taskItem: any) => {
                  const textParam = taskItem.parameters?.find((p: any) => p?.parameterId === 'text');
                  const tk = textParam?.value ? translationKeyFromStoredValue(String(textParam.value)) : null;
                  if (tk) {
                    guidsSet.add(tk);
                  }
                });
              }
            });
          }
        });
      });
    }
  }

  return guidsSet;
}

/**
 * Merged translation strings for the current DDT: global project map plus flow-document
 * `meta.translations` on the active flow (and other flows as fallback), via {@link getTranslation}.
 */
export function useDDTTranslations(
  ddt: any | null | undefined,
  task?: any,
  version?: number,
  selectedNodeId?: string | null
): Record<string, string> {
  const {
    translations: globalTranslations,
    getTranslation,
    flowTranslationRevision,
  } = useProjectTranslations();

  const lastLoggedStateRef = useRef<{
    ddtId?: string;
    missingGuidsHash?: string;
    totalGuids?: number;
    translationsCount?: number;
  }>({});

  const ddtId = ddt?.id || ddt?._id || null;
  const taskStepsKeys = task?.steps
    ? (Array.isArray(task.steps)
        ? `array:${task.steps.length}`
        : Object.keys(task.steps).sort().join(','))
    : '';

  const translationsHash = useMemo(() => {
    if (!ddt) {
      return '';
    }
    const guidsSet = collectTranslationGuidSet(ddt, task);
    return Array.from(guidsSet)
      .sort()
      .map((guid) => `${guid}:${getTranslation(guid) ?? ''}`)
      .join('|');
  }, [ddt, task?.steps, globalTranslations, getTranslation, flowTranslationRevision]);

  const stableVersion = version ?? 0;
  const stableSelectedNodeId = selectedNodeId ?? null;
  const translationsCount = Object.keys(globalTranslations).length;

  const prevTranslationsCountRef = useRef<number>(0);
  useEffect(() => {
    if (translationsCount !== prevTranslationsCountRef.current) {
      prevTranslationsCountRef.current = translationsCount;
    }
  }, [translationsCount, ddt?.id, ddt?._id]);

  return useMemo(() => {
    if (!ddt) {
      return {};
    }

    const guidsSet = collectTranslationGuidSet(ddt, task);
    const guids = Array.from(guidsSet);

    if (guids.length === 0) {
      return {};
    }

    const globalTranslationsCount = Object.keys(globalTranslations).length;
    if (globalTranslationsCount === 0 && guids.length > 0) {
      console.warn('[useDDTTranslations] ⚠️ globalTranslations is empty (flow slice may still hold keys)', {
        ddtId: ddt?.id || ddt?._id,
        guidsCount: guids.length,
        sampleGuids: guids.slice(0, 5),
      });
    }

    const merged: Record<string, string> = {};
    const foundGuids: string[] = [];
    const missingGuids: string[] = [];

    guids.forEach((guid) => {
      const text = getTranslation(guid);
      if (text !== undefined) {
        merged[guid] = text;
        foundGuids.push(guid);
      } else {
        missingGuids.push(guid);
      }
    });

    if (missingGuids.length > 0 && globalTranslationsCount > 0) {
      console.warn('[useDDTTranslations] ⚠️ Some GUIDs not resolved via getTranslation (global+flow)', {
        ddtId: ddt?.id || ddt?._id,
        totalGuids: guids.length,
        foundCount: foundGuids.length,
        missingCount: missingGuids.length,
        globalTranslationsCount,
        sampleMissingGuids: missingGuids.slice(0, 5),
        sampleFoundGuids: foundGuids.slice(0, 5),
        sampleGlobalGuids: Object.keys(globalTranslations).slice(0, 5),
      });
    }

    const currentDdtId = ddt.id || ddt._id || 'no-id';
    const missingGuidsHash = missingGuids.length > 0 ? missingGuids.sort().join(',') : '';
    const totalGuids = guids.length;
    const currentTranslationsCount = Object.keys(globalTranslations).length;

    const lastState = lastLoggedStateRef.current;
    const hasStateChanged =
      lastState.ddtId !== currentDdtId ||
      lastState.missingGuidsHash !== missingGuidsHash ||
      lastState.totalGuids !== totalGuids ||
      lastState.translationsCount !== currentTranslationsCount;

    if (missingGuids.length > 0 && hasStateChanged) {
      lastLoggedStateRef.current = {
        ddtId: currentDdtId,
        missingGuidsHash,
        totalGuids,
        translationsCount: currentTranslationsCount,
      };
    }

    const finalCount = Object.keys(merged).length;
    if (finalCount === 0 && guids.length > 0 && translationsCount > 0) {
      console.error('[useDDTTranslations] ❌ ERROR: GUIDs extracted but no translations resolved', {
        ddtId: ddt?.id || ddt?._id,
        extractedGuidsCount: guids.length,
        globalTranslationsCount: translationsCount,
        sampleExtractedGuids: guids.slice(0, 5),
        sampleGlobalGuids: Object.keys(globalTranslations).slice(0, 5),
        missingGuidsCount: missingGuids.length,
        sampleMissingGuids: missingGuids.slice(0, 5),
      });
    }

    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ddtId,
    taskStepsKeys,
    translationsHash,
    stableVersion,
    stableSelectedNodeId,
    translationsCount,
    globalTranslations,
    getTranslation,
    flowTranslationRevision,
  ]);
}
