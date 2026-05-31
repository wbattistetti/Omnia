/**
 * Report readiness OpenAPI / webhook ConvAI: per ogni parametro SEND/RECEIVE indica
 * campi presenti (type, format, vincoli, description, extension) e gap per handoff al team backend.
 */

import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import { collectParamKeysFromBackendCallTask } from '@domain/backendAnalysis/realignBackendParametersFromOpenApiTask';
import {
  deriveBackendToolDefinition,
  deriveExportedToolName,
} from '@domain/iaAgentTools/backendToolDerivation';
import { toElevenLabsRequestBodySchema } from '@domain/openApi/adaptOpenApiJsonSchemaToElevenLabsToolSchema';
import {
  collectOpenApiCompileErrors,
  type OpenApiCompileValidationInput,
} from './collectOpenApiCompileErrors';
import {
  buildParameterGaps,
  type ParameterAuditProfile,
} from './parameterReadinessSemantics';
import { summarizeOpenApiSchemaFragment } from './summarizeOpenApiSchemaFragment';
import { TaskType, type Task } from '@types/taskTypes';

/** Extension OpenAPI consigliate per hint NL → parametri backend. */
export const AGENT_HINT_EXTENSION_KEYS = [
  'x-agent-instructions',
  'x-openai-isConsequential',
] as const;

export type ReadinessSeverity = 'ok' | 'warning' | 'blocker';

export type ParameterFieldPresence = {
  type: boolean;
  format: boolean;
  enum: boolean;
  minMax: boolean;
  pattern: boolean;
  description: boolean;
  xAgentInstructions: boolean;
  xOpenaiIsConsequential: boolean;
};

/** Valori effettivi letti dallo schema OpenAPI (per UI e copia testo). */
export type ParameterFieldValues = {
  type?: string;
  format?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  description?: string;
  xAgentInstructions?: string;
  xOpenaiIsConsequential?: string;
};

export type ParameterReadinessEntry = {
  path: string;
  /** Chiave wire top-level OpenAPI (es. `constraints` per `constraints.allowedWeekdays`). */
  rootKey: string;
  /** 0 = top-level sotto rootKey; 1+ = annidamento (constraints → figli). */
  nestingDepth: number;
  direction: 'send' | 'receive';
  /** True se il parametro finisce nello schema tool ConvAI (solo SEND). */
  inConvaiTool: boolean;
  /** Profilo semantico per audit mirato (input vs output passivo/interpretativo). */
  auditProfile: ParameterAuditProfile;
  /** Nota contestuale sul ruolo del parametro nell’agente. */
  auditNote: string;
  present: ParameterFieldPresence;
  values: ParameterFieldValues;
  gaps: string[];
  severity: ReadinessSeverity;
  openapiSummary: string;
  elevenLabsSummary: string;
};

export type BackendWebhookReadiness = {
  taskId: string;
  taskLabel: string;
  toolName: string;
  toolDescriptionOk: boolean;
  deriveToolError: string | null;
  importState: string;
  entries: ParameterReadinessEntry[];
  blockers: number;
  warnings: number;
};

export type AgentWebhookReadinessReport = {
  generatedAt: string;
  backendCount: number;
  backends: BackendWebhookReadiness[];
  totalBlockers: number;
  totalWarnings: number;
};

const SPEC_SUFFIX = ' — spec incompleta';
const MIN_DESCRIPTION_LEN = 12;
const MAX_NEST_DEPTH = 4;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function effectiveType(schema: Record<string, unknown>): string {
  const t = schema.type;
  if (typeof t === 'string' && t.trim()) return t.trim().toLowerCase();
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return 'string';
  if (isRecord(schema.properties) && Object.keys(schema.properties).length > 0) return 'object';
  if (schema.items !== undefined) return 'array';
  return '';
}

function parseIssuePath(msg: string): { path: string; reason: string } | null {
  const idx = msg.indexOf(':');
  if (idx <= 0) return null;
  const path = msg.slice(0, idx).trim();
  let reason = msg.slice(idx + 1).trim();
  if (reason.endsWith(SPEC_SUFFIX)) reason = reason.slice(0, -SPEC_SUFFIX.length).trim();
  return { path, reason };
}

function groupCompileIssuesByPath(
  input: OpenApiCompileValidationInput
): Map<string, string> {
  const map = new Map<string, string>();
  for (const msg of collectOpenApiCompileErrors(input)) {
    const parsed = parseIssuePath(msg);
    if (!parsed) continue;
    map.set(parsed.path, parsed.reason);
  }
  return map;
}

function validationInputFromMeta(meta: BackendCallSpecMeta): OpenApiCompileValidationInput {
  return {
    jsonSchemasByApiName: {
      ...(meta.openapiOutputJsonSchemaByApiName ?? {}),
      ...(meta.openapiInputJsonSchemaByApiName ?? {}),
    },
    paramUiKindsByApiName: meta.openapiInputUiKindByApiName,
    paramEnumsByApiName: meta.openapiInputEnumByApiName,
  };
}

function mergedJsonSchemas(meta: BackendCallSpecMeta): Record<string, Record<string, unknown>> {
  return {
    ...(meta.openapiOutputJsonSchemaByApiName ?? {}),
    ...(meta.openapiInputJsonSchemaByApiName ?? {}),
  };
}

function resolveFragment(
  meta: BackendCallSpecMeta,
  paramKey: string,
  direction: 'send' | 'receive'
): Record<string, unknown> | undefined {
  const fromJson =
    direction === 'send'
      ? meta.openapiInputJsonSchemaByApiName?.[paramKey]
      : meta.openapiOutputJsonSchemaByApiName?.[paramKey];
  if (fromJson && isRecord(fromJson)) return fromJson;
  return undefined;
}

function fieldPresence(schema: Record<string, unknown>): ParameterFieldPresence {
  const t = effectiveType(schema);
  const desc =
    typeof schema.description === 'string' ? schema.description.trim() : '';
  const xAgent =
    typeof schema['x-agent-instructions'] === 'string'
      ? schema['x-agent-instructions'].trim()
      : '';
  return {
    type: !!t,
    format: typeof schema.format === 'string' && !!schema.format.trim(),
    enum: Array.isArray(schema.enum) && schema.enum.length > 0,
    minMax:
      typeof schema.minimum === 'number' ||
      typeof schema.maximum === 'number' ||
      typeof schema.exclusiveMinimum === 'number' ||
      typeof schema.exclusiveMaximum === 'number',
    pattern: typeof schema.pattern === 'string' && !!schema.pattern.trim(),
    description: desc.length >= MIN_DESCRIPTION_LEN,
    xAgentInstructions: xAgent.length > 0,
    xOpenaiIsConsequential: Object.prototype.hasOwnProperty.call(
      schema,
      'x-openai-isConsequential'
    ),
  };
}

/** Segmenti path report: `slots`, `[]`, `date` da `slots[].date`. */
function parseReportPathSegments(reportPath: string): string[] {
  const segments: string[] = [];
  let i = 0;
  while (i < reportPath.length) {
    if (reportPath[i] === '.') {
      i += 1;
      continue;
    }
    if (reportPath[i] === '[' && reportPath[i + 1] === ']') {
      segments.push('[]');
      i += 2;
      continue;
    }
    let j = i;
    while (
      j < reportPath.length &&
      reportPath[j] !== '.' &&
      !(reportPath[j] === '[' && reportPath[j + 1] === ']')
    ) {
      j += 1;
    }
    if (j > i) segments.push(reportPath.slice(i, j));
    i = j;
  }
  return segments;
}

/**
 * Risolve lo schema al `fullPath` partendo dal frammento top-level `rootKey` (es. slots → slots[].date).
 */
export function resolveSchemaAtReportPath(
  rootFragment: Record<string, unknown> | undefined,
  fullPath: string,
  rootKey: string
): Record<string, unknown> | undefined {
  if (!rootFragment) return undefined;
  if (fullPath === rootKey) return rootFragment;

  const suffix = fullPath.startsWith(rootKey) ? fullPath.slice(rootKey.length) : fullPath;
  if (!suffix) return rootFragment;

  const segments = parseReportPathSegments(suffix);
  if (segments.length === 0) return rootFragment;
  let cur: unknown = rootFragment;
  for (const seg of segments) {
    if (seg === '[]') {
      if (!isRecord(cur)) return undefined;
      cur = cur.items;
      continue;
    }
    if (!isRecord(cur)) return undefined;
    const props = cur.properties;
    if (isRecord(props) && Object.prototype.hasOwnProperty.call(props, seg)) {
      cur = props[seg];
      continue;
    }
    return undefined;
  }
  return isRecord(cur) ? cur : undefined;
}

function extractFieldValues(schema: Record<string, unknown> | undefined): ParameterFieldValues {
  if (!schema) return {};
  const out: ParameterFieldValues = {};
  const t = effectiveType(schema);
  if (t) out.type = t;
  if (typeof schema.format === 'string' && schema.format.trim()) {
    out.format = schema.format.trim();
  }
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    out.enum = schema.enum.map((x) => String(x));
  }
  if (typeof schema.minimum === 'number') out.minimum = schema.minimum;
  if (typeof schema.maximum === 'number') out.maximum = schema.maximum;
  if (typeof schema.pattern === 'string' && schema.pattern.trim()) {
    out.pattern = schema.pattern.trim();
  }
  if (typeof schema.description === 'string' && schema.description.trim()) {
    out.description = schema.description.trim();
  }
  if (typeof schema['x-agent-instructions'] === 'string') {
    const x = schema['x-agent-instructions'].trim();
    if (x) out.xAgentInstructions = x;
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'x-openai-isConsequential')) {
    out.xOpenaiIsConsequential = String(schema['x-openai-isConsequential']);
  }
  return out;
}

function collectPathsUnderFragment(rootKey: string, fragment: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (p: string) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    out.push(p);
  };

  function walk(path: string, schema: unknown, depth: number): void {
    push(path);
    if (!isRecord(schema) || depth >= MAX_NEST_DEPTH) return;
    const t = effectiveType(schema);
    if (t === 'object' && isRecord(schema.properties)) {
      for (const [key, child] of Object.entries(schema.properties)) {
        walk(path ? `${path}.${key}` : key, child, depth + 1);
      }
    }
    if (t === 'array' && schema.items !== undefined) {
      walk(`${path}[]`, schema.items, depth + 1);
    }
  }

  walk(rootKey, fragment, 0);
  return out.sort((a, b) => a.localeCompare(b));
}

function collectElevenLabsToolPaths(inputSchema: Record<string, unknown>): Set<string> {
  const adapted = toElevenLabsRequestBodySchema(inputSchema);
  const props = adapted.properties;
  if (!isRecord(props)) return new Set();
  const paths = new Set<string>();
  for (const key of Object.keys(props)) {
    const frag = props[key];
    if (!isRecord(frag)) {
      paths.add(key);
      continue;
    }
    for (const p of collectPathsUnderFragment(key, frag)) paths.add(p);
  }
  return paths;
}

function needsNlMappingHints(t: string, present: ParameterFieldPresence): boolean {
  if (t === 'string' && !present.format && !present.enum && !present.pattern) return true;
  if (t === 'integer' || t === 'number') {
    return !present.minMax && !present.enum;
  }
  return false;
}

/** Profondità annidamento rispetto a `rootKey` (0 = nodo radice wire). */
export function nestingDepthForReportPath(path: string, rootKey: string): number {
  if (path === rootKey) return 0;
  if (!path.startsWith(`${rootKey}.`)) {
    const parts = path.replace(/\[\]/g, '.').split('.').filter(Boolean);
    return Math.max(0, parts.length - 1);
  }
  return path.slice(rootKey.length + 1).split('.').filter(Boolean).length;
}

/**
 * Raggruppa entry ordinate per path: radice + discendenti immediati (es. constraints + figli).
 */
export function groupReportEntriesByTree(
  entries: readonly ParameterReadinessEntry[]
): ParameterReadinessEntry[][] {
  const groups: ParameterReadinessEntry[][] = [];
  let i = 0;
  while (i < entries.length) {
    const root = entries[i];
    const group: ParameterReadinessEntry[] = [root];
    i += 1;
    const prefix = `${root.path}.`;
    while (i < entries.length && entries[i].path.startsWith(prefix)) {
      group.push(entries[i]);
      i += 1;
    }
    groups.push(group);
  }
  return groups;
}

/** Campi OpenAPI mostrabili nel report (UI e testo). */
export type ParameterReportField =
  | 'type'
  | 'format'
  | 'enum'
  | 'minMax'
  | 'pattern'
  | 'description'
  | 'xAgentInstructions'
  | 'xOpenaiIsConsequential';

/**
 * Proprietà OpenAPI pertinenti al tipo del parametro: evita rumore (es. min/max su boolean).
 */
export function applicableReportFieldsForEntry(
  entry: Pick<
    ParameterReadinessEntry,
    'values' | 'present' | 'direction' | 'inConvaiTool' | 'auditProfile'
  >
): ParameterReportField[] {
  if (entry.auditProfile === 'receive-passive') {
    const fields: ParameterReportField[] = ['type'];
    if (entry.present.description || entry.values.description) {
      fields.push('description');
    }
    return fields;
  }

  const t = (entry.values.type ?? '').toLowerCase();
  const fields: ParameterReportField[] = ['type'];

  if (t === 'object' || t === 'array') {
    fields.push('description');
    return fields;
  }

  if (t === 'string') {
    fields.push('format', 'enum', 'pattern');
  } else if (t === 'integer' || t === 'number') {
    fields.push('minMax', 'enum');
  }

  fields.push('description');

  if (entry.auditProfile === 'send-input' && t && needsNlMappingHints(t, entry.present)) {
    fields.push('xAgentInstructions');
  }
  if (
    entry.auditProfile === 'receive-interactive' &&
    t &&
    needsNlMappingHints(t, entry.present)
  ) {
    fields.push('xAgentInstructions');
  }

  if (
    entry.direction === 'send' &&
    entry.inConvaiTool &&
    (entry.present.xOpenaiIsConsequential || entry.values.xOpenaiIsConsequential)
  ) {
    fields.push('xOpenaiIsConsequential');
  }

  return fields;
}

function buildGapsForPath(
  path: string,
  schema: Record<string, unknown> | undefined,
  direction: 'send' | 'receive',
  inConvaiTool: boolean,
  compileIssue: string | undefined
): {
  gaps: string[];
  severity: ReadinessSeverity;
  present: ParameterFieldPresence;
  auditProfile: ParameterAuditProfile;
  auditNote: string;
} {
  const empty: ParameterFieldPresence = {
    type: false,
    format: false,
    enum: false,
    minMax: false,
    pattern: false,
    description: false,
    xAgentInstructions: false,
    xOpenaiIsConsequential: false,
  };

  if (!schema) {
    const gaps = ['schema OpenAPI assente per questo path'];
    if (compileIssue) gaps.push(compileIssue);
    return {
      gaps,
      severity: direction === 'send' ? 'blocker' : 'warning',
      present: empty,
      auditProfile: direction === 'send' ? 'send-input' : 'receive-passive',
      auditNote:
        direction === 'send'
          ? 'Input tool ConvAI: l’agente traduce frasi utente in questo valore.'
          : 'Output backend: nessuna conversione da linguaggio naturale richiesta.',
    };
  }

  const present = fieldPresence(schema);
  const t = effectiveType(schema);
  const format =
    typeof schema.format === 'string' && schema.format.trim() ? schema.format.trim() : undefined;

  const result = buildParameterGaps({
    path,
    direction,
    inConvaiTool,
    type: t,
    present,
    format,
    compileIssue,
  });

  return {
    gaps: result.gaps,
    severity: result.severity,
    present,
    auditProfile: result.profile,
    auditNote: result.auditNote,
  };
}

function entryForPath(
  path: string,
  rootKey: string,
  direction: 'send' | 'receive',
  rootFragment: Record<string, unknown> | undefined,
  elevenLabsRoot: Record<string, unknown> | undefined,
  inConvaiTool: boolean,
  issuesByPath: Map<string, string>
): ParameterReadinessEntry {
  const schema = resolveSchemaAtReportPath(rootFragment, path, rootKey);
  const elSchema = resolveSchemaAtReportPath(elevenLabsRoot, path, rootKey);
  const compileIssue = issuesByPath.get(path);
  const { gaps, severity, present, auditProfile, auditNote } = buildGapsForPath(
    path,
    schema,
    direction,
    inConvaiTool,
    compileIssue
  );
  return {
    path,
    rootKey,
    nestingDepth: nestingDepthForReportPath(path, rootKey),
    direction,
    inConvaiTool,
    auditProfile,
    auditNote,
    present,
    values: extractFieldValues(schema),
    gaps,
    severity,
    openapiSummary: schema ? summarizeOpenApiSchemaFragment(schema) : '(assente)',
    elevenLabsSummary:
      direction === 'send' && elSchema
        ? summarizeOpenApiSchemaFragment(elSchema)
        : direction === 'send'
          ? '(non nel tool)'
          : 'n/a (RECEIVE)',
  };
}

/**
 * Audit readiness per un singolo Backend Call (tool ConvAI + parametri wire SEND/RECEIVE).
 */
export function buildBackendWebhookReadiness(task: Task): BackendWebhookReadiness {
  const taskId = String(task.id ?? '').trim();
  const taskLabel = String((task as Task & { label?: string }).label ?? taskId).trim() || taskId;
  const toolName = deriveExportedToolName(task);
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  const importState = meta?.importState ?? 'missing';
  const toolDesc = String(
    (task as Task & { backendToolDescription?: string }).backendToolDescription ?? ''
  ).trim();

  const derive = deriveBackendToolDefinition(task);
  const deriveToolError = derive.ok ? null : derive.error;
  const elevenLabsPaths =
    derive.ok && isRecord(derive.tool.inputSchema)
      ? collectElevenLabsToolPaths(derive.tool.inputSchema as Record<string, unknown>)
      : new Set<string>();

  const issuesByPath = meta && meta.importState === 'ok'
    ? groupCompileIssuesByPath(validationInputFromMeta(meta))
    : new Map<string, string>();

  const entries: ParameterReadinessEntry[] = [];
  const wire = collectParamKeysFromBackendCallTask(task);

  if (!meta || meta.importState !== 'ok') {
    for (const wp of wire) {
      const direction = wp.direction === 'output' ? 'receive' : 'send';
      entries.push({
        path: wp.paramKey,
        rootKey: wp.paramKey,
        nestingDepth: 0,
        direction,
        inConvaiTool: false,
        auditProfile: direction === 'send' ? 'send-input' : 'receive-passive',
        auditNote:
          direction === 'send'
            ? 'Input tool ConvAI: l’agente traduce frasi utente in questo valore.'
            : 'Output backend: nessuna conversione da linguaggio naturale richiesta.',
        present: {
          type: false,
          format: false,
          enum: false,
          minMax: false,
          pattern: false,
          description: false,
          xAgentInstructions: false,
          xOpenaiIsConsequential: false,
        },
        values: {},
        gaps: ['OpenAPI non importato (Recupera specifiche sul Backend Call)'],
        severity: 'blocker',
        openapiSummary: '(import mancante)',
        elevenLabsSummary: direction === 'send' ? '(import mancante)' : 'n/a (RECEIVE)',
      });
    }
  } else {
    const schemas = mergedJsonSchemas(meta);
    for (const wp of wire) {
      const direction = wp.direction === 'output' ? 'receive' : 'send';
      const fragment = resolveFragment(meta, wp.paramKey, direction);
      const paths =
        fragment && isRecord(fragment)
          ? collectPathsUnderFragment(wp.paramKey, fragment)
          : [wp.paramKey];

      const elRoot =
        direction === 'send' && derive.ok && isRecord(derive.tool.inputSchema)
          ? (derive.tool.inputSchema as Record<string, unknown>).properties?.[wp.paramKey]
          : undefined;
      const elRootObj = isRecord(elRoot) ? elRoot : undefined;

      for (const path of paths) {
        const inConvai =
          direction === 'send' &&
          (elevenLabsPaths.has(path) || elevenLabsPaths.has(wp.paramKey));
        entries.push(
          entryForPath(
            path,
            wp.paramKey,
            direction,
            fragment,
            elRootObj,
            inConvai,
            issuesByPath
          )
        );
      }

      if (!fragment && direction === 'send') {
        const kind = meta.openapiInputUiKindByApiName?.[wp.paramKey];
        if (kind) {
          entries.push(
            entryForPath(
              wp.paramKey,
              wp.paramKey,
              direction,
              undefined,
              elRootObj,
              elevenLabsPaths.has(wp.paramKey),
              issuesByPath
            )
          );
        }
      }
    }

    for (const [apiName, fragment] of Object.entries(schemas)) {
      if (!isRecord(fragment)) continue;
      const already = entries.some((e) => e.path === apiName || e.path.startsWith(`${apiName}.`));
      if (!already) {
        const dir = meta.openapiInputJsonSchemaByApiName?.[apiName] ? 'send' : 'receive';
        for (const path of collectPathsUnderFragment(apiName, fragment)) {
          entries.push(
            entryForPath(
              path,
              apiName,
              dir,
              fragment,
              undefined,
              dir === 'send' && elevenLabsPaths.has(path),
              issuesByPath
            )
          );
        }
      }
    }
  }

  const deduped = new Map<string, ParameterReadinessEntry>();
  for (const e of entries) {
    const key = `${e.direction}:${e.path}`;
    const prev = deduped.get(key);
    if (!prev || severityRank(e.severity) > severityRank(prev.severity)) {
      deduped.set(key, e);
    }
  }
  const sorted = [...deduped.values()].sort((a, b) =>
    a.direction === b.direction
      ? a.path.localeCompare(b.path)
      : a.direction.localeCompare(b.direction)
  );

  const blockers = sorted.filter((e) => e.severity === 'blocker').length;
  const warnings = sorted.filter((e) => e.severity === 'warning').length;

  return {
    taskId,
    taskLabel,
    toolName,
    toolDescriptionOk: toolDesc.length >= MIN_DESCRIPTION_LEN,
    deriveToolError,
    importState,
    entries: sorted,
    blockers,
    warnings,
  };
}

function severityRank(s: ReadinessSeverity): number {
  if (s === 'blocker') return 2;
  if (s === 'warning') return 1;
  return 0;
}

export type ReadinessGroupSummary = {
  worst: ReadinessSeverity;
  blockers: number;
  warnings: number;
  okCount: number;
};

/** Riepilogo severità per accordion (padre + figli). */
export function summarizeReadinessGroup(
  group: readonly ParameterReadinessEntry[]
): ReadinessGroupSummary {
  let worst: ReadinessSeverity = 'ok';
  let blockers = 0;
  let warnings = 0;
  let okCount = 0;
  for (const e of group) {
    if (e.severity === 'blocker') {
      blockers += 1;
      worst = 'blocker';
    } else if (e.severity === 'warning') {
      warnings += 1;
      if (worst !== 'blocker') worst = 'warning';
    } else {
      okCount += 1;
    }
  }
  return { worst, blockers, warnings, okCount };
}

export function worstSeverity(a: ReadinessSeverity, b: ReadinessSeverity): ReadinessSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

/**
 * Report aggregato per tutti i Backend Call collegati come tool ConvAI dell’agente.
 */
export function buildAgentWebhookReadinessReport(options: {
  backendTaskIds: readonly string[];
  getTask: (id: string) => Task | null | undefined;
}): AgentWebhookReadinessReport {
  const backends: BackendWebhookReadiness[] = [];
  for (const id of options.backendTaskIds) {
    const tid = String(id ?? '').trim();
    if (!tid) continue;
    const task = options.getTask(tid);
    if (!task || task.type !== TaskType.BackendCall) continue;
    backends.push(buildBackendWebhookReadiness(task));
  }
  backends.sort((a, b) => a.taskLabel.localeCompare(b.taskLabel));
  const totalBlockers = backends.reduce((n, b) => n + b.blockers, 0);
  const totalWarnings = backends.reduce((n, b) => n + b.warnings, 0);
  return {
    generatedAt: new Date().toISOString(),
    backendCount: backends.length,
    backends,
    totalBlockers,
    totalWarnings,
  };
}

function formatFieldValueLine(
  label: string,
  present: boolean,
  value: string | undefined
): string {
  if (present && value) return `    ${label}: ${value}`;
  if (present) return `    ${label}: (presente)`;
  return `    ${label}: (assente)`;
}

function formatEntryFieldLine(field: ParameterReportField, e: ParameterReadinessEntry): string {
  const v = e.values;
  switch (field) {
    case 'type':
      return formatFieldValueLine('type', e.present.type, v.type);
    case 'format':
      return formatFieldValueLine('format', e.present.format, v.format);
    case 'enum': {
      const en = v.enum?.length ? v.enum.join(', ') : undefined;
      return formatFieldValueLine('enum', e.present.enum, en);
    }
    case 'minMax': {
      const mm =
        v.minimum !== undefined || v.maximum !== undefined
          ? `min ${v.minimum ?? '—'} max ${v.maximum ?? '—'}`
          : undefined;
      return formatFieldValueLine('min/max', e.present.minMax, mm);
    }
    case 'pattern':
      return formatFieldValueLine('pattern', e.present.pattern, v.pattern);
    case 'description':
      return formatFieldValueLine(
        'description',
        e.present.description,
        v.description?.slice(0, 200)
      );
    case 'xAgentInstructions':
      return formatFieldValueLine(
        'x-agent-instructions',
        e.present.xAgentInstructions,
        v.xAgentInstructions?.slice(0, 200)
      );
    case 'xOpenaiIsConsequential':
      return formatFieldValueLine(
        'x-openai-isConsequential',
        e.present.xOpenaiIsConsequential,
        v.xOpenaiIsConsequential
      );
  }
}

function formatEntryBlock(e: ParameterReadinessEntry): string[] {
  const lines: string[] = [];
  const tag =
    e.severity === 'blocker' ? 'BLOCKER' : e.severity === 'warning' ? 'WARNING' : 'OK';
  const icon = e.severity === 'blocker' ? '✗' : e.severity === 'warning' ? '⚠' : '✓';
  const dir = e.direction === 'send' ? 'SEND' : 'RECEIVE';
  const convai = e.inConvaiTool ? 'tool ConvAI' : e.direction === 'send' ? 'non in tool' : 'solo prompt';

  if (e.auditProfile === 'receive-passive' && e.severity === 'ok') {
    lines.push(
      `  ${icon} [${tag}] ${dir} · ${e.path} (${convai}) — ${e.auditNote}`
    );
    if (e.openapiSummary) lines.push(`    OpenAPI: ${e.openapiSummary}`);
    return lines;
  }

  const indent = '  '.repeat(2 + e.nestingDepth);
  lines.push(`${indent}${icon} [${tag}] ${dir} · ${e.path} (${convai})`);
  lines.push(`${indent}  Ruolo: ${e.auditNote}`);
  lines.push(`${indent}  OpenAPI: ${e.openapiSummary || '—'}`);
  if (e.direction === 'send') {
    lines.push(`${indent}  ElevenLabs: ${e.elevenLabsSummary || '—'}`);
  }
  for (const field of applicableReportFieldsForEntry(e)) {
    lines.push(`${indent}${formatEntryFieldLine(field, e).trimStart()}`);
  }
  if (e.gaps.length) {
    for (const g of e.gaps) lines.push(`${indent}  MANCA: ${g}`);
  }
  return lines;
}

/**
 * Testo Markdown/plain per clipboard e Monaco (handoff team backend).
 */
export function formatWebhookReadinessReport(report: AgentWebhookReadinessReport): string {
  const lines: string[] = [
    'Report readiness OpenAPI / webhook ConvAI (ElevenLabs)',
    `Generato: ${report.generatedAt}`,
    `Backend analizzati: ${report.backendCount}`,
    `Riepilogo: ${report.totalBlockers} BLOCKER · ${report.totalWarnings} WARNING`,
    '',
    'Legenda:',
    '  SEND = input tool ConvAI (BLOCKER se manca type/format; WARNING se manca mapping NL).',
    '  RECEIVE interpretativo = output che l’agente mappa in dialogo/catalogo (solo WARNING).',
    '  RECEIVE passivo = contatori/metriche backend (OK, nessun mapping NL).',
    `Extension consigliate: ${AGENT_HINT_EXTENSION_KEYS.join(', ')}`,
    '',
  ];

  if (report.backends.length === 0) {
    lines.push('Nessun Backend Call collegato come tool ConvAI (convaiBackendToolTaskIds / catalogo).');
    return lines.join('\n');
  }

  for (const b of report.backends) {
    lines.push('═'.repeat(72));
    lines.push(`Backend: ${b.taskLabel} (task ${b.taskId})`);
    lines.push(`Tool ConvAI: ${b.toolName} · import OpenAPI: ${b.importState}`);
    if (b.deriveToolError) {
      lines.push(`Tool derivazione: ERRORE — ${b.deriveToolError}`);
    }
    if (!b.toolDescriptionOk) {
      lines.push('MANCA: descrizione tool ConvAI (backendToolDescription) troppo corta o assente');
    }
    lines.push(`Parametri: ${b.entries.length} · ${b.blockers} BLOCKER · ${b.warnings} WARNING`);
    if (b.entries.some((e) => e.direction === 'receive')) {
      const passive = b.entries.filter((e) => e.auditProfile === 'receive-passive').length;
      const interactive = b.entries.filter((e) => e.auditProfile === 'receive-interactive').length;
      lines.push(
        `RECEIVE: ${interactive} interpretativi · ${passive} passivi (contatori/metriche, OK senza mapping NL).`
      );
    }
    lines.push('');

    if (b.entries.length === 0) {
      lines.push('  (nessun parametro wire SEND/RECEIVE sul task)');
      lines.push('');
      continue;
    }

    for (const group of groupReportEntriesByTree(b.entries)) {
      for (const e of group) {
        lines.push(...formatEntryBlock(e));
      }
    }
    lines.push('');
  }

  lines.push('— Fine report —');
  lines.push(
    'Azioni suggerite per il team backend: arricchire lo OpenAPI con type/format/enum, description',
    'con esempi NL, e x-agent-instructions dove il mapping naturale non è ovvio.'
  );
  return lines.join('\n');
}
