/**
 * Deriva {@link ToolDefinition} dai task Backend Call per ConvAI / function-calling:
 * naming (label → operationId → segmento URL), sanitizzazione, schema parametri da righe SEND.
 */

import type { Task } from '@types/taskTypes';
import { TaskType } from '@types/taskTypes';
import type { IAAgentConfig, ToolDefinition } from 'types/iaAgentRuntimeSetup';
import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import { mergeConvaiBackendToolIdLists } from '@domain/iaAgentTools/manualCatalogBackendToolIds';

/** Limite pratico per nomi tool stile OpenAI / gateway ConvAI. */
export const CONVAI_TOOL_NAME_MAX_LENGTH = 64;

/** Consente lettere, cifre e underscore (stabile per runtime e matching). */
export function sanitizeConvaiToolName(raw: string): string {
  const step1 = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  let out = step1;
  if (/^[0-9]/.test(out)) {
    out = `t_${out}`;
  }
  if (!out) out = 'tool';
  if (out.length > CONVAI_TOOL_NAME_MAX_LENGTH) {
    const hash = simpleHash32(out);
    const suffix = `_${hash}`;
    const maxBase = CONVAI_TOOL_NAME_MAX_LENGTH - suffix.length;
    out = out.slice(0, Math.max(8, maxBase)) + suffix;
  }
  return out.slice(0, CONVAI_TOOL_NAME_MAX_LENGTH);
}

function simpleHash32(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 0xfff).toString(16).padStart(3, '0');
}

/** Ultimo segmento non vuoto del path dell’URL (fallback naming). */
export function lastUrlPathSegment(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return last && last.trim() ? last.trim() : 'endpoint';
  } catch {
    return 'endpoint';
  }
}

function readEndpoint(task: Task): { url: string } {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
  return {
    url: ep && typeof ep.url === 'string' ? ep.url.trim() : '',
  };
}

/**
 * Priorità naming esportato verso ConvAI: label interna → operationId OpenAPI → foglia URL.
 * La label interna deve essere valorizzata per backend selezionati come tool (controllo a compilazione).
 */
export function deriveRawExportedToolName(task: Task): string {
  const label = String((task as Task & { label?: string }).label ?? '').trim();
  if (label) return label;
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  const oid =
    meta && typeof meta.openapiOperationId === 'string' ? meta.openapiOperationId.trim() : '';
  if (oid) return oid;
  const { url } = readEndpoint(task);
  return lastUrlPathSegment(url || 'https://invalid.invalid/endpoint');
}

/** Nome tool sanitizzato effettivamente esposto al modello. */
export function deriveExportedToolName(task: Task): string {
  return sanitizeConvaiToolName(deriveRawExportedToolName(task));
}

type BackendInputRow = {
  internalName?: string;
  apiParam?: string;
  variable?: string;
  fieldDescription?: string;
};

/**
 * Costruisce una proprietà JSON Schema per ConvAI da una riga SEND + meta Read API (tipi OpenAPI).
 */
function jsonSchemaPropertyForToolRow(
  row: BackendInputRow,
  metaKinds: Record<string, string> | undefined,
  metaEnums: Record<string, string[]> | undefined,
  metaJsonSchemas: Record<string, Record<string, unknown>> | undefined,
  propertyKey: string
): Record<string, unknown> {
  const api = (row.apiParam || '').trim();
  const desc = (row.fieldDescription || '').trim();
  const resolvedFragment =
    (api && metaJsonSchemas?.[api]) ||
    metaJsonSchemas?.[propertyKey] ||
    (api ? metaJsonSchemas?.[propertyKey] : undefined);
  if (
    resolvedFragment &&
    typeof resolvedFragment === 'object' &&
    !Array.isArray(resolvedFragment) &&
    Object.keys(resolvedFragment).length > 0
  ) {
    return {
      ...resolvedFragment,
      ...(desc ? { description: desc } : {}),
    };
  }

  const kindRaw =
    (api && metaKinds?.[api]) ||
    metaKinds?.[propertyKey] ||
    (api && metaKinds?.[propertyKey]);
  const kind = typeof kindRaw === 'string' ? kindRaw.trim() : '';

  if (kind === 'boolean') {
    return { type: 'boolean', ...(desc ? { description: desc } : {}) };
  }
  if (kind === 'number') {
    return { type: 'number', ...(desc ? { description: desc } : {}) };
  }
  if (kind === 'enum') {
    const en =
      (api && metaEnums?.[api]) || metaEnums?.[propertyKey] || (api ? metaEnums?.[api] : undefined);
    if (en && en.length > 0) {
      return { type: 'string', enum: [...en], ...(desc ? { description: desc } : {}) };
    }
  }
  if (kind === 'object') {
    return { type: 'object', ...(desc ? { description: desc } : {}) };
  }
  return {
    type: 'string',
    ...(desc ? { description: desc } : {}),
  };
}

function propertyKeyFromRow(row: BackendInputRow): string {
  const api = (row.apiParam || '').trim();
  const internal = (row.internalName || '').trim();
  if (api) return api;
  const raw = internal.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'param';
  return sanitizeConvaiToolName(raw);
}

/**
 * JSON Schema (`type: object`) per i parametri del tool, derivato dalle righe SEND del Backend Call.
 * Con `task`, i tipi provengono da `backendCallSpecMeta.openapiInputUiKindByApiName` dopo Read API.
 */
export function buildToolInputSchemaFromBackendInputs(
  inputRows: BackendInputRow[] | undefined,
  task?: Task
): Record<string, unknown> {
  const meta = task
    ? (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta
    : undefined;
  const metaKinds = meta?.openapiInputUiKindByApiName as Record<string, string> | undefined;
  const metaEnums = meta?.openapiInputEnumByApiName;
  const metaJsonSchemas = meta?.openapiInputJsonSchemaByApiName;

  const rows = Array.isArray(inputRows)
    ? inputRows.filter((r) => r?.internalName?.trim() || r?.apiParam?.trim())
    : [];
  const properties: Record<string, unknown> = {};
  for (const row of rows) {
    const key = propertyKeyFromRow(row);
    if (properties[key]) continue;
    properties[key] = jsonSchemaPropertyForToolRow(row, metaKinds, metaEnums, metaJsonSchemas, key);
  }
  return {
    type: 'object',
    properties,
  };
}

/** True se l’endpoint del Backend Call punta a POST BookFromAgenda (Express). */
export function taskTargetsBookFromAgenda(task: Task): boolean {
  const ep = (task as Task & { endpoint?: { url?: string } }).endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim().toLowerCase() : '';
  return url.includes('bookfromagenda');
}

/**
 * Aggiunge al JSON Schema tool ConvAI i campi scope v4.5 (camelCase) se non già presenti nelle righe SEND.
 */
export function mergeBookFromAgendaScopeIntoInputSchema(
  schema: Record<string, unknown>,
  inputRows?: BackendInputRow[] | undefined
): Record<string, unknown> {
  const prevProps =
    schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? { ...(schema.properties as Record<string, unknown>) }
      : {};
  const defaults: Record<string, Record<string, unknown>> = {
    conversationId: {
      type: 'string',
      description:
        'Runtime: scope conversazione — variabile dinamica `omnia_conversation_id` / orchestratore; non richiesto in SEND.',
    },
    projectId: {
      type: 'string',
      description:
        'Design-time (obbligatorio in SEND): identificativo stabile app/versione per chiave Redis.',
    },
    forceRefresh: {
      type: 'boolean',
      description:
        'Runtime: true prima materializzazione; false follow-up snapshot; dedotto dal backend se omesso.',
    },
  };
  /** Scope BookFromAgenda: tipi da whitelist OpenAPI — sovrascrive righe SEND che avevano imposto `type: string`. */
  const properties: Record<string, unknown> = { ...prevProps };
  for (const [k, def] of Object.entries(defaults)) {
    const prev = properties[k];
    const prevObj =
      prev && typeof prev === 'object' && !Array.isArray(prev) ? (prev as Record<string, unknown>) : {};
    properties[k] = { ...prevObj, ...def };
  }
  const agendaDefaults: Record<string, Record<string, unknown>> = {
    'agenda.url': {
      type: 'string',
      description:
        'Prima materializzazione: URL agenda pubblicata (es. feed Bolt/Supabase). Se presente, include anche agenda.type.',
    },
    'agenda.type': {
      type: 'string',
      description:
        'Tipo adattatore agenda URL (per feed JSON UniversalAgenda usare "Omnia").',
    },
    'agenda.json': {
      type: 'object',
      description: 'Alternativa a agenda.url: UniversalAgenda inline.',
    },
  };
  for (const [k, def] of Object.entries(agendaDefaults)) {
    if (properties[k] !== undefined) continue;
    properties[k] = def;
  }

  const appendHint = (prev: unknown, hint: string): Record<string, unknown> => {
    const prevObj =
      prev && typeof prev === 'object' && !Array.isArray(prev) ? (prev as Record<string, unknown>) : {};
    const prevDesc =
      typeof prevObj.description === 'string' && prevObj.description.trim().length > 0
        ? prevObj.description.trim()
        : '';
    const description = prevDesc ? `${prevDesc} ${hint}` : hint;
    return { ...prevObj, description };
  };
  const isLikelyVariableRef = (raw: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);

  const rows = Array.isArray(inputRows) ? inputRows : [];
  const fixedByApiName = new Map<string, string>();
  for (const row of rows) {
    const api = String(row.apiParam ?? '').trim();
    const v = String(row.variable ?? '').trim();
    if (!api || !v || isLikelyVariableRef(v)) continue;
    if (
      api === 'agenda.url' ||
      api === 'agenda.type' ||
      api === 'projectId' ||
      api === 'forceRefresh'
    ) {
      fixedByApiName.set(api, v);
    }
  }

  const fixedString = (apiName: string): void => {
    const lit = fixedByApiName.get(apiName);
    if (!lit) return;
    const prev = properties[apiName];
    properties[apiName] = {
      ...appendHint(prev, `(Valore fissato da Omnia: ${lit})`),
      type: 'string',
      enum: [lit],
    };
  };
  const fixedBoolean = (apiName: string): void => {
    const litRaw = fixedByApiName.get(apiName);
    if (!litRaw) return;
    const tr = litRaw.toLowerCase();
    const parsed = tr === 'true' || tr === '1' ? true : tr === 'false' || tr === '0' ? false : null;
    if (parsed === null) return;
    const prev = properties[apiName];
    properties[apiName] = {
      ...appendHint(prev, `(Valore fissato da Omnia: ${String(parsed)})`),
      type: 'boolean',
      enum: [parsed],
    };
  };
  fixedString('agenda.url');
  fixedString('agenda.type');
  fixedString('projectId');
  fixedBoolean('forceRefresh');

  /** OpenAPI `SchedulingQueryConstraints` è un oggetto; senza `type: object` ConvAI tende a inviare una stringa JSON. ElevenLabs EU rifiuta `additionalProperties` su questo fragment (extra_forbidden). */
  {
    const qcPrev = properties['queryConstraints'];
    const prevDesc =
      qcPrev && typeof qcPrev === 'object' && !Array.isArray(qcPrev)
        ? ({ ...(qcPrev as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    delete prevDesc.additionalProperties;
    const hint =
      'Invia come oggetto JSON (SchedulingQueryConstraints), mai come stringa serializzata.';
    const description =
      typeof prevDesc.description === 'string' && prevDesc.description.trim().length > 0
        ? `${prevDesc.description.trim()} ${hint}`
        : hint;
    properties['queryConstraints'] = {
      ...prevDesc,
      type: 'object',
      description,
    };
  }

  /**
   * Obbligatori:
   * - projectId + conversationId (scope runtime/cache),
   * - sorgente agenda quando presente nel tool (agenda.url+agenda.type o agenda.json).
   */
  const reqSet = new Set<string>(['projectId', 'conversationId']);
  const prevReq = Array.isArray(schema.required)
    ? schema.required.filter((x): x is string => typeof x === 'string')
    : [];
  for (const x of prevReq) reqSet.add(x);
  const hasAgendaUrl = Object.prototype.hasOwnProperty.call(properties, 'agenda.url');
  const hasAgendaJson = Object.prototype.hasOwnProperty.call(properties, 'agenda.json');
  if (hasAgendaUrl) {
    reqSet.add('agenda.url');
    reqSet.add('agenda.type');
  } else if (hasAgendaJson) {
    reqSet.add('agenda.json');
  }
  return {
    ...schema,
    type: 'object',
    properties,
    required: [...reqSet],
  };
}

export type DeriveBackendToolFailureCode =
  | 'not_backend_call'
  | 'missing_label'
  | 'missing_backend_tool_description'
  /** Solo UI (task non in repository); non emesso da {@link deriveBackendToolDefinition}. */
  | 'missing_task';

export type DeriveBackendToolResult =
  | { ok: true; tool: ToolDefinition }
  | { ok: false; code: DeriveBackendToolFailureCode; error: string };

/**
 * Costruisce un singolo {@link ToolDefinition} da un task Backend Call.
 * Richiede label interna e `backendToolDescription` non vuoti.
 */
export function deriveBackendToolDefinition(task: Task): DeriveBackendToolResult {
  if (task.type !== TaskType.BackendCall) {
    return {
      ok: false,
      code: 'not_backend_call',
      error: 'Il task non è di tipo BackendCall.',
    };
  }
  const internalLabel = String((task as Task & { label?: string }).label ?? '').trim();
  if (!internalLabel) {
    return {
      ok: false,
      code: 'missing_label',
      error: 'Nome interno (label) obbligatorio sul Backend Call.',
    };
  }
  const description = String(
    (task as Task & { backendToolDescription?: string }).backendToolDescription ?? ''
  ).trim();
  if (!description) {
    return {
      ok: false,
      code: 'missing_backend_tool_description',
      error: 'Descrizione tool ConvAI obbligatoria (campo «Descrizione per ConvAI» sul Backend Call).',
    };
  }
  const name = deriveExportedToolName(task);
  const inputRows = (task as Task & { inputs?: BackendInputRow[] }).inputs;
  let inputSchema = buildToolInputSchemaFromBackendInputs(inputRows, task);
  if (taskTargetsBookFromAgenda(task)) {
    inputSchema = mergeBookFromAgendaScopeIntoInputSchema(inputSchema, inputRows);
  }
  return {
    ok: true,
    tool: { name, description, inputSchema },
  };
}

/** Risolve collisioni su `name` aggiungendo suffissi numerici stabilizzati. */
export function dedupeToolDefinitionNames(tools: ToolDefinition[]): ToolDefinition[] {
  const used = new Set<string>();
  return tools.map((t) => {
    let name = t.name;
    let k = 0;
    while (used.has(name)) {
      k += 1;
      name = sanitizeConvaiToolName(`${t.name}_${k}`);
    }
    used.add(name);
    return name === t.name ? t : { ...t, name };
  });
}

export type MergeEffectiveIaAgentToolsOptions = {
  /** Id task Backend Call delle righe `backendCatalog.manualEntries` (tab Backends dell’editor). */
  manualCatalogBackendTaskIds?: readonly string[];
};

/**
 * Unisce tool manuali (`cfg.tools`) e tool derivati dai Backend Call in `convaiBackendToolTaskIds`
 * più eventuali backend catalogo manuale progetto (`manualCatalogBackendTaskIds`).
 */
export function mergeEffectiveIaAgentTools(
  cfg: IAAgentConfig,
  getTask: (taskId: string) => Task | null | undefined,
  options?: MergeEffectiveIaAgentToolsOptions
): ToolDefinition[] {
  const manual = Array.isArray(cfg.tools) ? [...cfg.tools] : [];
  const fromCfg = Array.isArray(cfg.convaiBackendToolTaskIds)
    ? cfg.convaiBackendToolTaskIds.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const fromCatalog = options?.manualCatalogBackendTaskIds ?? [];
  const ids = mergeConvaiBackendToolIdLists(fromCfg, fromCatalog);
  const derived: ToolDefinition[] = [];
  for (const id of ids) {
    const t = getTask(id);
    if (!t) continue;
    const r = deriveBackendToolDefinition(t);
    if (r.ok) derived.push(r.tool);
  }
  return dedupeToolDefinitionNames([...manual, ...derived]);
}
