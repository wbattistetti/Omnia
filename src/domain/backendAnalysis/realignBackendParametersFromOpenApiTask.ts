/**
 * Allinea i parametri dell’analisi backend alla firma OpenAPI corrente sul task Backend Call.
 * Usato dopo «Recupera specifiche»: rimuove parametri obsoleti e aggiunge quelli nuovi.
 */

import { TaskType, type Task } from '@types/taskTypes';
import type {
  BackendAnalysisDocumentV2,
  BackendParameterAnalysisRecord,
} from './backendAnalysisDocumentV2';

export type BackendCallWireParam = {
  paramKey: string;
  direction: 'input' | 'output';
};

/** Nomi parametro SEND/RECEIVE dal task (wire OpenAPI, non internalName). */
export function collectParamKeysFromBackendCallTask(task: Task): BackendCallWireParam[] {
  if (task.type !== TaskType.BackendCall) return [];
  const out: BackendCallWireParam[] = [];
  const t = task as Task & {
    inputs?: Array<{ internalName?: string; apiParam?: string; apiName?: string }>;
    outputs?: Array<{ internalName?: string; apiField?: string; apiName?: string }>;
  };
  for (const inp of t.inputs ?? []) {
    const paramKey = String(inp.apiParam ?? inp.apiName ?? inp.internalName ?? '').trim();
    if (paramKey) out.push({ paramKey, direction: 'input' });
  }
  for (const o of t.outputs ?? []) {
    const paramKey = String(o.apiField ?? o.apiName ?? o.internalName ?? '').trim();
    if (paramKey) out.push({ paramKey, direction: 'output' });
  }
  return out;
}

function findExistingParamRecord(
  parameters: Record<string, BackendParameterAnalysisRecord>,
  paramKey: string
): BackendParameterAnalysisRecord | undefined {
  if (parameters[paramKey]) return parameters[paramKey];
  const lower = paramKey.toLowerCase();
  const key = Object.keys(parameters).find((k) => k.toLowerCase() === lower);
  return key ? parameters[key] : undefined;
}

/**
 * Sostituisce la mappa parametri del backend con quella derivata dal task (post Read API).
 * Conserva testi IA per parametri ancora presenti (match case-insensitive sul nome wire).
 */
export function realignBackendParametersFromOpenApiTask(
  doc: BackendAnalysisDocumentV2,
  catalogEntryId: string,
  task: Task,
  displayLabel?: string
): BackendAnalysisDocumentV2 {
  const existing = doc.backends[catalogEntryId];
  const wireParams = collectParamKeysFromBackendCallTask(task);
  const prevParams = existing?.parameters ?? {};

  const parameters: Record<string, BackendParameterAnalysisRecord> = {};
  for (const wp of wireParams) {
    const prev = findExistingParamRecord(prevParams, wp.paramKey);
    parameters[wp.paramKey] = prev
      ? { ...prev, paramKey: wp.paramKey, direction: wp.direction }
      : {
          paramKey: wp.paramKey,
          direction: wp.direction,
          kind: 'required',
          role: '',
          descriptionShort: '',
          analysisSummary: '',
          analysisDetailMarkdown: '',
        };
  }

  return {
    ...doc,
    backends: {
      ...doc.backends,
      [catalogEntryId]: {
        catalogEntryId,
        displayLabel: displayLabel?.trim() || existing?.displayLabel || catalogEntryId,
        howToUseMarkdown: existing?.howToUseMarkdown ?? '',
        parameters,
        suggestedFeatures: existing?.suggestedFeatures ?? [],
      },
    },
  };
}
