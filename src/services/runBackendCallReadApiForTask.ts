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
  slugInternalName,
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

function collectUsedInternalNames(inputs: IoRow[], outputs: IoRow[]): Set<string> {
  const s = new Set<string>();
  for (const i of inputs) {
    const t = i.internalName?.trim();
    if (t) s.add(t);
  }
  for (const o of outputs) {
    const t = o.internalName?.trim();
    if (t) s.add(t);
  }
  return s;
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

export type RunBackendCallReadApiResult =
  | {
      ok: true;
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
    const fields = extractOperationFields(doc, pathKey, method);
    if (!fields) {
      return { ok: false, error: `Operazione ${method} non trovata per ${pathKey}.` };
    }

    const inputNames = [...new Set([...fields.requestParamNames, ...fields.requestBodyPropertyNames])].filter(
      Boolean
    );
    const outputNames = fields.responsePropertyNames.filter(Boolean);
    const inputDesc = fields.inputDescriptionsByApiName;
    const outputDesc = fields.outputDescriptionsByApiName;
    const inputUiKindByApiName: Record<string, string> = { ...fields.inputUiKindByApiName };
    const operationDocBlurb = buildOperationDocBlurbFromOpenApiFields(fields);
    const currentToolDesc = String(
      (task as Task & { backendToolDescription?: string }).backendToolDescription ?? ''
    ).trim();

    const contentHash = hashString(JSON.stringify(doc));
    const fp = structuralFingerprint(method, fpSeed);

    const used = collectUsedInternalNames(prevInputs, prevOutputs);
    let nextInputs = prevInputs;
    let nextOutputs = prevOutputs;

    if (inputNames.length > 0 || outputNames.length > 0) {
      if (inputsEmpty && inputNames.length > 0) {
        nextInputs = inputNames.map((apiName) => ({
          internalName: nextUniqueInternalName(slugInternalName(apiName), used),
          apiParam: apiName,
          variable: '',
          ...(inputDesc[apiName]?.trim() ? { fieldDescription: inputDesc[apiName] } : {}),
        }));
      } else if (!inputsEmpty && inputNames.length > 0) {
        nextInputs = prevInputs.map((row) => {
          const api = row.apiParam?.trim();
          const swaggerDesc = api ? inputDesc[api] : undefined;
          if (!row.fieldDescription?.trim() && swaggerDesc?.trim()) {
            return { ...row, fieldDescription: swaggerDesc };
          }
          return row;
        });
      }
      if (outputsEmpty && outputNames.length > 0) {
        nextOutputs = outputNames.map((apiName) => ({
          internalName: nextUniqueInternalName(slugInternalName(apiName), used),
          apiField: apiName,
          variable: '',
          ...(outputDesc[apiName]?.trim() ? { fieldDescription: outputDesc[apiName] } : {}),
        }));
      } else if (!outputsEmpty && outputNames.length > 0) {
        nextOutputs = prevOutputs.map((row) => {
          const api = row.apiField?.trim();
          const swaggerDesc = api ? outputDesc[api] : undefined;
          if (!row.fieldDescription?.trim() && swaggerDesc?.trim()) {
            return { ...row, fieldDescription: swaggerDesc };
          }
          return row;
        });
      }
    }

    const taskUpdates: Partial<Task> = {
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
