/**
 * Catalogo parametri SEND da OpenAPI materializzato sul task Backend Call (leaf path + tipo + descrizione).
 */

import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import { TaskType, type Task } from '@types/taskTypes';
import { collectParamKeysFromBackendCallTask } from '@domain/backendAnalysis/realignBackendParametersFromOpenApiTask';

const MAX_DEPTH = 5;
const MAX_LEAVES = 96;

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

/** Ruolo suggerito per UI / proposte compile (euristica sul path). */
export type BackendSendSemanticRole =
  | 'horizon_start'
  | 'horizon_end'
  | 'constraint'
  | 'value'
  | 'other';

export interface BackendSendParamLeaf {
  path: string;
  type: string;
  format?: string;
  description?: string;
  semanticRole: BackendSendSemanticRole;
}

/** Fine intervallo / upper bound (qualsiasi naming OpenAPI). */
export function isBoundEndSendPath(path: string): boolean {
  const p = path.trim().toLowerCase();
  return (
    /horizon\.end$/.test(p) ||
    p === 'horizon.end' ||
    /\.(end|until|to|finish|max|last)$/.test(p) ||
    /(dateto|date_to|enddate|end_date|rangend|range_end|upperbound|upper_bound)/.test(p)
  );
}

/** Inizio intervallo / lower bound (qualsiasi naming OpenAPI). */
export function isBoundStartSendPath(path: string): boolean {
  const p = path.trim().toLowerCase();
  return (
    /horizon\.start$/.test(p) ||
    p === 'horizon.start' ||
    /\.(start|from|begin|min|first)$/.test(p) ||
    /(datefrom|date_from|startdate|start_date|rangestart|range_start|lowerbound|lower_bound)/.test(
      p
    )
  );
}

export function inferSemanticRoleFromSendPath(path: string): BackendSendSemanticRole {
  const p = path.trim().toLowerCase();
  if (isBoundStartSendPath(p)) return 'horizon_start';
  if (isBoundEndSendPath(p)) return 'horizon_end';
  if (
    /(constraints|queryconstraints|mandatory|forbidden|weekdays|allowedintervals|preferred)/.test(p)
  ) {
    return 'constraint';
  }
  if (/\b(date|time)\b/.test(p) && !/constraints/.test(p)) {
    return 'value';
  }
  return 'other';
}

/** Miglior leaf per bound start/end tra i path disponibili. */
export function pickSendLeafForBound(
  leaves: readonly BackendSendParamLeaf[],
  bound: 'start' | 'end'
): BackendSendParamLeaf | undefined {
  const test = bound === 'end' ? isBoundEndSendPath : isBoundStartSendPath;
  const role = bound === 'end' ? 'horizon_end' : 'horizon_start';
  const byRole = leaves.find((l) => l.semanticRole === role);
  if (byRole && test(byRole.path)) return byRole;
  return leaves.find((l) => test(l.path) && (l.format === 'date' || l.type === 'string'));
}

function mergedInputSchemas(meta: BackendCallSpecMeta): Record<string, Record<string, unknown>> {
  return { ...(meta.openapiInputJsonSchemaByApiName ?? {}) };
}

function resolveInputFragment(
  meta: BackendCallSpecMeta,
  paramKey: string
): Record<string, unknown> | undefined {
  const fromJson = meta.openapiInputJsonSchemaByApiName?.[paramKey];
  if (fromJson && isRecord(fromJson)) return fromJson;
  return undefined;
}

function walkSchemaLeaves(
  pathPrefix: string,
  schema: Record<string, unknown>,
  depth: number,
  out: BackendSendParamLeaf[]
): void {
  if (out.length >= MAX_LEAVES || depth > MAX_DEPTH) return;

  const desc =
    typeof schema.description === 'string' && schema.description.trim()
      ? schema.description.trim()
      : undefined;
  const t = effectiveType(schema);

  if (t === 'object' && isRecord(schema.properties)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (!isRecord(child)) continue;
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      walkSchemaLeaves(childPath, child, depth + 1, out);
    }
    return;
  }

  if (!pathPrefix || t === 'object' || t === 'array' || !t) return;

  const format = typeof schema.format === 'string' ? schema.format.trim() : undefined;
  out.push({
    path: pathPrefix,
    type: t,
    ...(format ? { format } : {}),
    ...(desc ? { description: desc } : {}),
    semanticRole: inferSemanticRoleFromSendPath(pathPrefix),
  });
}

/**
 * Estrae i leaf SEND da un task Backend Call con meta OpenAPI importata.
 */
export function collectBackendSendLeavesFromTask(task: Task | null | undefined): BackendSendParamLeaf[] {
  if (!task || task.type !== TaskType.BackendCall) return [];
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  if (!meta || meta.importState !== 'ok') return [];

  const inputKeys = collectParamKeysFromBackendCallTask(task)
    .filter((w) => w.direction === 'input')
    .map((w) => w.paramKey);
  const schemas = mergedInputSchemas(meta);
  const leaves: BackendSendParamLeaf[] = [];
  const seen = new Set<string>();

  for (const paramKey of inputKeys) {
    const fragment = resolveInputFragment(meta, paramKey) ?? schemas[paramKey];
    if (fragment && isRecord(fragment)) {
      walkSchemaLeaves(paramKey, fragment, 0, leaves);
    }
  }

  const deduped: BackendSendParamLeaf[] = [];
  for (const leaf of leaves) {
    if (seen.has(leaf.path)) continue;
    seen.add(leaf.path);
    deduped.push(leaf);
  }
  deduped.sort((a, b) => a.path.localeCompare(b.path));
  return deduped;
}

/** Set di path SEND ammessi (allowlist validazione). */
export function buildSendPathAllowlist(leaves: readonly BackendSendParamLeaf[]): ReadonlySet<string> {
  return new Set(leaves.map((l) => l.path.trim()));
}

/** Trova il leaf migliore per ruolo semantico preferito. */
export function pickSendLeafByRole(
  leaves: readonly BackendSendParamLeaf[],
  role: BackendSendSemanticRole
): BackendSendParamLeaf | undefined {
  return leaves.find((l) => l.semanticRole === role);
}
