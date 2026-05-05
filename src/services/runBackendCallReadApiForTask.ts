/**
 * Esegue «Read API» (OpenAPI → righe SEND/RECEIVE + backendCallSpecMeta) sul task Backend Call.
 * Usato da BackendCallEditor e dall’header compresso del tab Backends (AI Agent).
 */

import { hashString, structuralFingerprint } from '../domain/backendCatalog';
import type { Task } from '../types/taskTypes';
import { taskRepository } from './TaskRepository';
import {
  buildOperationDocBlurbFromOpenApiFields,
  extractOperationFields,
  fetchOpenApiDocumentOperationalThenManualFallback,
  pickOpenApiPathForReadApi,
} from './openApiBackendCallSpec';

type IoRow = {
  internalName: string;
  apiParam?: string;
  variable?: string;
  fieldDescription?: string;
  apiField?: string;
};

function filterRows(rows: unknown): IoRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r: IoRow) => Boolean(r?.internalName?.trim())) as IoRow[];
}

function normalizeTaskHttpMethod(m: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' {
  const u = String(m || 'GET')
    .trim()
    .toUpperCase();
  if (u === 'GET' || u === 'POST' || u === 'PUT' || u === 'DELETE' || u === 'PATCH') return u;
  return 'GET';
}

function nextUniqueInternalName(base: string, used: Set<string>): string {
  let n = base;
  let k = 0;
  while (used.has(n)) {
    k += 1;
    n = `${base}_${k}`;
  }
  used.add(n);
  return n;
}

function toTreeInternalName(apiName: string): string {
  const raw = String(apiName || '').trim();
  if (!raw) return 'field';
  const safe = raw
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'field';
}

function rebuildInputRows(
  prevInputs: IoRow[],
  apiNames: string[],
  inputDesc: Record<string, string>,
  used: Set<string>
): IoRow[] {
  const byApi = new Map<string, IoRow>();
  for (const row of prevInputs) {
    const k = row.apiParam?.trim();
    if (!k || byApi.has(k)) continue;
    byApi.set(k, row);
  }
  const next: IoRow[] = [];
  for (const apiName of apiNames) {
    const prev = byApi.get(apiName);
    const internalName = prev?.internalName?.trim()
      ? nextUniqueInternalName(prev.internalName.trim(), used)
      : nextUniqueInternalName(toTreeInternalName(apiName), used);
    next.push({
      internalName,
      apiParam: apiName,
      variable: prev?.variable ?? '',
      ...(prev?.fieldDescription?.trim()
        ? { fieldDescription: prev.fieldDescription }
        : inputDesc[apiName]?.trim()
          ? { fieldDescription: inputDesc[apiName] }
          : {}),
    });
  }
  return next;
}

function rebuildOutputRows(
  prevOutputs: IoRow[],
  apiNames: string[],
  outputDesc: Record<string, string>,
  used: Set<string>
): IoRow[] {
  const byApi = new Map<string, IoRow>();
  for (const row of prevOutputs) {
    const k = row.apiField?.trim();
    if (!k || byApi.has(k)) continue;
    byApi.set(k, row);
  }
  const next: IoRow[] = [];
  for (const apiName of apiNames) {
    const prev = byApi.get(apiName);
    const internalName = prev?.internalName?.trim()
      ? nextUniqueInternalName(prev.internalName.trim(), used)
      : nextUniqueInternalName(toTreeInternalName(apiName), used);
    next.push({
      internalName,
      apiField: apiName,
      variable: prev?.variable ?? '',
      ...(prev?.fieldDescription?.trim()
        ? { fieldDescription: prev.fieldDescription }
        : outputDesc[apiName]?.trim()
          ? { fieldDescription: outputDesc[apiName] }
          : {}),
    });
  }
  return next;
}

export type RunBackendCallReadApiResult =
  | {
      ok: true;
      /** Metodo HTTP effettivo letto dallo spec (es. POST) dopo auto-selezione. */
      resolvedMethod: string;
      inputNames: string[];
      outputNames: string[];
      inputDescriptionsByApiName: Record<string, string>;
      outputDescriptionsByApiName: Record<string, string>;
    }
  | { ok: false; error: string };

/** Opzioni Read API: Spec URL usato solo se fallisce la discovery sull’endpoint operativo. */
export type RunBackendCallReadApiOptions = {
  openapiSpecUrl?: string;
};

/**
 * Scarica OpenAPI, aggiorna inputs/outputs e `backendCallSpecMeta` sul task.
 * @param operationalUrl Endpoint operativo (path per `pickOpenApiPathForReadApi` + primo tentativo discovery).
 * @param options.openapiSpecUrl Secondo tentativo se il primo fallisce (opzionale).
 */
export async function runBackendCallReadApiForTask(
  instanceId: string,
  projectId: string | undefined,
  operationalUrl: string,
  method: string,
  options?: RunBackendCallReadApiOptions
): Promise<RunBackendCallReadApiResult> {
  const op = operationalUrl.trim();
  const manual = (options?.openapiSpecUrl || '').trim();
  if (!op && !manual) {
    return { ok: false, error: 'Inserire endpoint operativo o Spec URL (OpenAPI).' };
  }

  const task = taskRepository.getTask(instanceId);
  if (!task) {
    return { ok: false, error: 'Task non trovato' };
  }

  const prevInputs = filterRows((task as Task & { inputs?: unknown }).inputs);
  const prevOutputs = filterRows((task as Task & { outputs?: unknown }).outputs);
  const inputsEmpty = prevInputs.length === 0;
  const outputsEmpty = prevOutputs.length === 0;

  const fpSeed = op || manual;

  try {
    const { doc } = await fetchOpenApiDocumentOperationalThenManualFallback(op, manual || undefined);
    const pathPickUrl = fpSeed;
    const picked = pickOpenApiPathForReadApi(pathPickUrl, doc, method);
    if ('error' in picked) {
      return { ok: false, error: picked.error };
    }
    const pathKey = picked.pathKey;
    const resolvedMethodLower = picked.method;
    const resolvedMethodUpper = normalizeTaskHttpMethod(resolvedMethodLower);
    const fields = extractOperationFields(doc, pathKey, resolvedMethodLower);
    if (!fields) {
      return {
        ok: false,
        error: `Operazione ${resolvedMethodUpper} non trovata per ${pathKey}.`,
      };
    }

    const inputNames = [...new Set([...fields.requestParamNames, ...fields.requestBodyPropertyNames])].filter(
      Boolean
    );
    const outputNames = fields.responsePropertyNames.filter(Boolean);
    const inputDesc = fields.inputDescriptionsByApiName;
    const outputDesc = fields.outputDescriptionsByApiName;
    const inputUiKindByApiName: Record<string, string> = { ...fields.inputUiKindByApiName };
    const inputEnumByApiName: Record<string, string[]> = { ...fields.inputEnumByApiName };
    const operationDocBlurb = buildOperationDocBlurbFromOpenApiFields(fields);
    const currentToolDesc = String(
      (task as Task & { backendToolDescription?: string }).backendToolDescription ?? ''
    ).trim();

    const contentHash = hashString(JSON.stringify(doc));
    const fp = structuralFingerprint(resolvedMethodUpper, fpSeed);

    const used = new Set<string>();
    const nextInputs = inputNames.length > 0
      ? rebuildInputRows(prevInputs, inputNames, inputDesc, used)
      : (inputsEmpty ? [] : prevInputs);
    const nextOutputs = outputNames.length > 0
      ? rebuildOutputRows(prevOutputs, outputNames, outputDesc, used)
      : (outputsEmpty ? [] : prevOutputs);

    const prevEp = (task as Task & { endpoint?: { url?: string; method?: string; headers?: Record<string, string> } })
      .endpoint;
    const endpointBase =
      prevEp && typeof prevEp === 'object'
        ? prevEp
        : { url: op.trim() || '', method: 'GET', headers: {} as Record<string, string> };

    const taskUpdates: Partial<Task> = {
      endpoint: {
        ...endpointBase,
        url: (endpointBase.url && String(endpointBase.url).trim()) || op.trim() || '',
        method: resolvedMethodUpper,
      },
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: new Date().toISOString(),
        contentHash,
        importState: 'ok',
        structuralFingerprint: fp,
        openapiOperationId: fields.operationId ?? null,
        openapiDescriptionSnapshots: {
          inputs: { ...inputDesc },
          outputs: { ...outputDesc },
        },
        openapiInputUiKindByApiName: inputUiKindByApiName,
        openapiInputEnumByApiName: inputEnumByApiName,
      },
      inputs: nextInputs,
      outputs: nextOutputs,
    };
    if (operationDocBlurb && !currentToolDesc) {
      taskUpdates.backendToolDescription = operationDocBlurb;
    }

    taskRepository.updateTask(instanceId, taskUpdates, projectId);

    return {
      ok: true,
      resolvedMethod: resolvedMethodUpper,
      inputNames,
      outputNames,
      inputDescriptionsByApiName: { ...inputDesc },
      outputDescriptionsByApiName: { ...outputDesc },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    taskRepository.updateTask(
      instanceId,
      {
        backendCallSpecMeta: {
          schemaVersion: 1,
          lastImportedAt: null,
          contentHash: null,
          importState: 'error',
          lastError: msg.slice(0, 500),
          structuralFingerprint: structuralFingerprint(method, fpSeed),
        },
      } as Partial<Task>,
      projectId
    );
    return { ok: false, error: msg };
  }
}
