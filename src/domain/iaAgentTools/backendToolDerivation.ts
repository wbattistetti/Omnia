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
  fieldDescription?: string;
};

function propertyKeyFromRow(row: BackendInputRow): string {
  const api = (row.apiParam || '').trim();
  const internal = (row.internalName || '').trim();
  const raw = api || internal.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'param';
  return sanitizeConvaiToolName(raw.replace(/\./g, '_'));
}

/**
 * JSON Schema (`type: object`) per i parametri del tool, derivato dalle righe SEND del Backend Call.
 */
export function buildToolInputSchemaFromBackendInputs(
  inputRows: BackendInputRow[] | undefined
): Record<string, unknown> {
  const rows = Array.isArray(inputRows) ? inputRows.filter((r) => r?.internalName?.trim()) : [];
  const properties: Record<string, unknown> = {};
  for (const row of rows) {
    const key = propertyKeyFromRow(row);
    if (properties[key]) continue;
    const desc = (row.fieldDescription || '').trim();
    properties[key] = {
      type: 'string',
      ...(desc ? { description: desc } : {}),
    };
  }
  return {
    type: 'object',
    properties,
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
  const inputSchema = buildToolInputSchemaFromBackendInputs(inputRows);
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
