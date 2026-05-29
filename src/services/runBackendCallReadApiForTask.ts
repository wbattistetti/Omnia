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
import type { OpenApiSendBindingRules } from '../domain/backendCatalog/catalogTypes';
import { collectOpenApiCompileErrors } from '../domain/openApi/collectOpenApiCompileErrors';

type IoRow = {
  internalName: string;
  apiParam?: string;
  variable?: string;
  fieldDescription?: string;
  apiField?: string;
  /** Da `x-omnia.sendBinding` dopo Read API. */
  sendBindingOptional?: boolean;
  /** Obbligatorio in SEND a compile (`designTimeRequiredApiParams`). */
  sendBindingDesignTimeRequired?: boolean;
  /** Da `x-omnia.bindingPhase` / `x-runtime-mandatory` sul campo OpenAPI. */
  sendBindingBindingPhase?: 'design' | 'runtime';
  sendConstraintGroupId?: string;
  sendConstraintGroupLabel?: string;
};

function buildSendBindingRowFields(
  apiName: string,
  rules: OpenApiSendBindingRules | undefined
): Pick<
  IoRow,
  | 'sendBindingOptional'
  | 'sendBindingDesignTimeRequired'
  | 'sendConstraintGroupId'
  | 'sendConstraintGroupLabel'
> {
  if (!rules) return {};
  if (rules.optionalApiParams.includes(apiName)) {
    return { sendBindingOptional: true };
  }
  const design =
    rules.designTimeRequiredApiParams?.includes(apiName) === true
      ? { sendBindingDesignTimeRequired: true as const }
      : {};
  for (const set of rules.requireOneOfSets ?? []) {
    for (const alt of set.alternatives) {
      if (alt.allApiParams.includes(apiName)) {
        return {
          ...design,
          sendConstraintGroupId: set.id,
          ...(set.label?.trim() ? { sendConstraintGroupLabel: set.label.trim() } : {}),
        };
      }
    }
  }
  return Object.keys(design).length > 0 ? design : {};
}

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
  used: Set<string>,
  sendBinding?: OpenApiSendBindingRules,
  bindingPhaseByApiName?: Record<string, 'design' | 'runtime'>
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
    const bind = buildSendBindingRowFields(apiName, sendBinding);
    const phaseResolved = bindingPhaseByApiName?.[apiName] ?? prev?.sendBindingBindingPhase;
    next.push({
      internalName,
      apiParam: apiName,
      variable: prev?.variable ?? '',
      ...bind,
      ...(phaseResolved ? { sendBindingBindingPhase: phaseResolved } : {}),
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
      /** Path operativo risolto sul documento OpenAPI (pathname presente negli `paths`). */
      operationalPathMatched: boolean;
      inputNames: string[];
      outputNames: string[];
      inputDescriptionsByApiName: Record<string, string>;
      outputDescriptionsByApiName: Record<string, string>;
    }
  | {
      ok: false;
      error: string;
      /** Portale protetto: aprire modale «Connetti al portale». */
      portalAuth?: { code: string; origin: string };
    };

/** Opzioni Read API: Spec URL usato solo se fallisce la discovery sull’endpoint operativo. */
export type RunBackendCallReadApiOptions = {
  openapiSpecUrl?: string;
  /** PortalConnection — Bearer verso portale protetto (openapi-proxy). */
  portalConnectionId?: string;
  /** Ricarica lo spec senza merge con SEND/RECEIVE precedenti (Recupera specifiche). */
  forceRefresh?: boolean;
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
  const forceRefresh = Boolean(options?.forceRefresh);
  const mergeInputs = forceRefresh ? [] : prevInputs;
  const mergeOutputs = forceRefresh ? [] : prevOutputs;

  const fpSeed = op || manual;

  try {
    const connectionId = (options?.portalConnectionId || '').trim() || undefined;
    const fetchOptions: { connectionId?: string; forceRefresh?: boolean } = {};
    if (connectionId) fetchOptions.connectionId = connectionId;
    if (forceRefresh) fetchOptions.forceRefresh = true;
    const { doc } = await fetchOpenApiDocumentOperationalThenManualFallback(
      op,
      manual || undefined,
      Object.keys(fetchOptions).length > 0 ? fetchOptions : undefined
    );
    const pathPickUrl = fpSeed;
    const picked = pickOpenApiPathForReadApi(pathPickUrl, doc, method);
    if ('error' in picked) {
      return { ok: false, error: picked.error };
    }
    const pathKey = picked.pathKey;
    /** Lock UI solo se c’è URL operativo: altrimenti snapshot vs campo endpoint è ambiguo (solo Spec URL). */
    const operationalPathMatched = picked.operationalPathMatched;
    const effectiveMethodLock = operationalPathMatched && op.trim().length > 0;
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
    const sendBinding = fields.sendBindingRules;
    const operationDocBlurb = buildOperationDocBlurbFromOpenApiFields(fields);
    const currentToolDesc = String(
      (task as Task & { backendToolDescription?: string }).backendToolDescription ?? ''
    ).trim();

    const contentHash = hashString(JSON.stringify(doc));
    const fp = structuralFingerprint(resolvedMethodUpper, fpSeed);

    const mergedSchemas = {
      ...(fields.outputJsonSchemaByApiName ?? {}),
      ...(fields.inputJsonSchemaByApiName ?? {}),
    };
    const openapiCompileErrors = collectOpenApiCompileErrors({
      jsonSchemasByApiName: mergedSchemas,
      paramUiKindsByApiName: inputUiKindByApiName,
      paramEnumsByApiName: inputEnumByApiName,
    });

    const used = new Set<string>();
    const nextInputs = inputNames.length > 0
      ? rebuildInputRows(mergeInputs, inputNames, inputDesc, used, sendBinding, fields.bindingPhaseByApiName)
      : (inputsEmpty || forceRefresh ? [] : prevInputs);
    const nextOutputs = outputNames.length > 0
      ? rebuildOutputRows(mergeOutputs, outputNames, outputDesc, used)
      : (outputsEmpty || forceRefresh ? [] : prevOutputs);

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
        ...(fields.inputParamHintsByPath || fields.outputParamHintsByPath
          ? {
              openapiParamHintsByPath: {
                inputs: { ...(fields.inputParamHintsByPath ?? {}) },
                outputs: { ...(fields.outputParamHintsByPath ?? {}) },
              },
            }
          : {}),
        openapiInputUiKindByApiName: inputUiKindByApiName,
        openapiInputEnumByApiName: inputEnumByApiName,
        ...(fields.inputJsonSchemaByApiName && Object.keys(fields.inputJsonSchemaByApiName).length > 0
          ? { openapiInputJsonSchemaByApiName: fields.inputJsonSchemaByApiName }
          : {}),
        ...(fields.outputJsonSchemaByApiName && Object.keys(fields.outputJsonSchemaByApiName).length > 0
          ? { openapiOutputJsonSchemaByApiName: fields.outputJsonSchemaByApiName }
          : {}),
        openapiSendBinding: sendBinding ?? null,
        openApiMethodLocked: effectiveMethodLock,
        openApiMethodLockUrlSnapshot: effectiveMethodLock ? op.trim() : null,
        openApiLockedHttpMethod: effectiveMethodLock ? resolvedMethodUpper : null,
        openapiCompileErrors,
      },
      inputs: nextInputs,
      outputs: nextOutputs,
    };
    if (operationDocBlurb && !currentToolDesc) {
      taskUpdates.backendToolDescription = operationDocBlurb;
    }

    taskRepository.updateTask(instanceId, taskUpdates, projectId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<{ taskId: string }>('omnia:backend-read-api-complete', {
          detail: { taskId: instanceId },
        })
      );
    }

    return {
      ok: true,
      resolvedMethod: resolvedMethodUpper,
      operationalPathMatched: effectiveMethodLock,
      inputNames,
      outputNames,
      inputDescriptionsByApiName: { ...inputDesc },
      outputDescriptionsByApiName: { ...outputDesc },
    };
  } catch (e) {
    const { PortalAuthRequiredError, PortalAuthExpiredError, inferPortalAuthFromFailedOpenApiFetch } =
      await import('./portalAuthErrors');
    const { OpenApiNotFoundError } = await import('./openApiDiscoveryErrors');
    if (e instanceof PortalAuthRequiredError || e instanceof PortalAuthExpiredError) {
      return { ok: false, error: e.message, portalAuth: { code: e.code, origin: e.origin } };
    }
    if (e instanceof OpenApiNotFoundError) {
      return { ok: false, error: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    const hadPortalConnection = Boolean((options?.portalConnectionId || '').trim());
    const inferred = hadPortalConnection
      ? null
      : inferPortalAuthFromFailedOpenApiFetch(op || manual, msg, 422);
    if (inferred) {
      return {
        ok: false,
        error: inferred.message,
        portalAuth: { code: inferred.code, origin: inferred.origin },
      };
    }
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
          openApiMethodLocked: false,
          openApiMethodLockUrlSnapshot: null,
          openApiLockedHttpMethod: null,
        },
      } as Partial<Task>,
      projectId
    );
    return { ok: false, error: msg };
  }
}

function isPlainObjectRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x && typeof x === 'object' && !Array.isArray(x));
}

/**
 * Parser fallback (nessun OpenAPI): oggetto JSON flat, solo valori primitivi di primo livello.
 * Oggetti e array annidati vengono ignorati. `""` e `null` → parametro opzionale (sendBinding).
 */
export function parseFlatJsonBodyExampleForSendKeys(raw: string): {
  keys: string[];
  optionalApiParams: string[];
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { keys: [], optionalApiParams: [], error: 'Incolla un esempio JSON (oggetto con chiavi di primo livello).' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { keys: [], optionalApiParams: [], error: 'JSON non valido: sintassi errata.' };
  }
  if (!isPlainObjectRecord(parsed)) {
    return {
      keys: [],
      optionalApiParams: [],
      error: 'Il JSON deve essere un oggetto { ... }, non un array o un valore singolo.',
    };
  }
  const keys: string[] = [];
  const optionalApiParams: string[] = [];
  for (const k of Object.keys(parsed)) {
    const name = String(k || '').trim();
    if (!name) continue;
    const v = parsed[k];
    if (v !== null && typeof v === 'object') {
      continue;
    }
    keys.push(name);
    if (v === '' || v === null) {
      optionalApiParams.push(name);
    }
  }
  if (keys.length === 0) {
    return {
      keys: [],
      optionalApiParams: [],
      error:
        'Nessun campo primitivo di primo livello (stringa, numero, boolean, null). Oggetti e array sono ignorati.',
    };
  }
  return { keys, optionalApiParams };
}

/**
 * Applica un esempio JSON flat ai soli SEND del task Backend Call (stesso merge di {@link rebuildInputRows}).
 * Non modifica RECEIVE. `openapiSpecUrl` sul task resta com’è (tipicamente vuoto in fallback).
 */
export function applyFlatJsonBodyExampleToBackendTask(
  instanceId: string,
  projectId: string | undefined,
  rawJson: string
): { ok: true; inputNames: string[] } | { ok: false; error: string } {
  const parsed = parseFlatJsonBodyExampleForSendKeys(rawJson);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  const task = taskRepository.getTask(instanceId);
  if (!task) {
    return { ok: false, error: 'Task non trovato.' };
  }
  const prevInputs = filterRows((task as Task & { inputs?: unknown }).inputs);
  const sendBinding: OpenApiSendBindingRules = { optionalApiParams: parsed.optionalApiParams };
  const used = new Set<string>();
  const nextInputs = rebuildInputRows(prevInputs, parsed.keys, {}, used, sendBinding, undefined);

  const contentHash = hashString(rawJson.trim());
  const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
  const op = String(ep?.url || '').trim();
  const methodRaw = String(ep?.method || 'GET').trim().toUpperCase();
  const method =
    methodRaw === 'GET' || methodRaw === 'POST' || methodRaw === 'PUT' || methodRaw === 'DELETE' || methodRaw === 'PATCH'
      ? methodRaw
      : 'GET';
  const fpSeed = op || 'json-snippet';
  const fp = structuralFingerprint(method, fpSeed);

  const openapiInputUiKindByApiName: Record<string, string> = {};
  for (const k of parsed.keys) {
    openapiInputUiKindByApiName[k] = 'text';
  }

  taskRepository.updateTask(
    instanceId,
    {
      inputs: nextInputs,
      backendCallSpecMeta: {
        schemaVersion: 1,
        lastImportedAt: new Date().toISOString(),
        contentHash,
        importState: 'ok',
        lastError: undefined,
        structuralFingerprint: fp,
        openapiOperationId: null,
        openapiDescriptionSnapshots: { inputs: {}, outputs: {} },
        openapiInputUiKindByApiName,
        openapiInputEnumByApiName: {},
        openapiSendBinding: sendBinding,
        openApiMethodLocked: false,
        openApiMethodLockUrlSnapshot: null,
        openApiLockedHttpMethod: null,
      },
    } as Partial<Task>,
    projectId
  );

  return { ok: true, inputNames: parsed.keys };
}
