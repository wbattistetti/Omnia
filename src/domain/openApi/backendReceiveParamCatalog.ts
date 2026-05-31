/**
 * Catalogo leaf RECEIVE da OpenAPI output schema (walk simmetrico a SEND).
 */

import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import { TaskType, type Task } from '@types/taskTypes';
import { collectParamKeysFromBackendCallTask } from '@domain/backendAnalysis/realignBackendParametersFromOpenApiTask';
import { inferSlotIdFromApiPath } from '@domain/backendOutputSlotBinding/inferSlotIdFromApiPath';

const MAX_DEPTH = 6;
const MAX_LEAVES = 128;

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

export interface BackendReceiveParamLeaf {
  path: string;
  type: string;
  format?: string;
  description?: string;
  suggestedSlotId?: string;
}

function resolveOutputFragment(
  meta: BackendCallSpecMeta,
  paramKey: string
): Record<string, unknown> | undefined {
  const fromJson = meta.openapiOutputJsonSchemaByApiName?.[paramKey];
  if (fromJson && isRecord(fromJson)) return fromJson;
  const hint = meta.openapiParamHintsByPath?.outputs?.[paramKey];
  if (hint && (hint.type || hint.format)) {
    const o: Record<string, unknown> = {};
    if (hint.type) o.type = hint.type;
    if (hint.format) o.format = hint.format;
    return o;
  }
  return undefined;
}

/**
 * Walk schema output: oggetti → `a.b`; array di oggetti → `a[].b` (allineato a apiField wire).
 */
function walkReceiveSchemaLeaves(
  pathPrefix: string,
  schema: Record<string, unknown>,
  depth: number,
  out: BackendReceiveParamLeaf[]
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
      walkReceiveSchemaLeaves(childPath, child, depth + 1, out);
    }
    return;
  }

  if (t === 'array' && isRecord(schema.items)) {
    const items = schema.items;
    const itemType = effectiveType(items);
    if (itemType === 'object' && isRecord(items.properties)) {
      for (const [key, child] of Object.entries(items.properties)) {
        if (!isRecord(child)) continue;
        const childPath = pathPrefix ? `${pathPrefix}[].${key}` : key;
        walkReceiveSchemaLeaves(childPath, child, depth + 1, out);
      }
      return;
    }
    if (pathPrefix) {
      const format = typeof items.format === 'string' ? items.format.trim() : undefined;
      out.push({
        path: `${pathPrefix}[]`,
        type: itemType || 'array',
        ...(format ? { format } : {}),
        ...(desc ? { description: desc } : {}),
        suggestedSlotId: inferSlotIdFromApiPath(pathPrefix),
      });
    }
    return;
  }

  if (!pathPrefix || t === 'object' || !t) return;

  const format = typeof schema.format === 'string' ? schema.format.trim() : undefined;
  out.push({
    path: pathPrefix,
    type: t,
    ...(format ? { format } : {}),
    ...(desc ? { description: desc } : {}),
    suggestedSlotId: inferSlotIdFromApiPath(pathPrefix),
  });
}

/**
 * Leaf RECEIVE da task Backend Call (OpenAPI import ok + chiavi output wire).
 */
export function collectBackendReceiveLeavesFromTask(
  task: Task | null | undefined
): BackendReceiveParamLeaf[] {
  if (!task || task.type !== TaskType.BackendCall) return [];
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  if (!meta || meta.importState !== 'ok') return [];

  const leaves: BackendReceiveParamLeaf[] = [];
  const seen = new Set<string>();

  const schemaKeys = new Set<string>([
    ...Object.keys(meta.openapiOutputJsonSchemaByApiName ?? {}),
    ...collectParamKeysFromBackendCallTask(task)
      .filter((w) => w.direction === 'output')
      .map((w) => w.paramKey.split(/[.[\]]/)[0] ?? w.paramKey)
      .filter(Boolean),
  ]);

  for (const paramKey of schemaKeys) {
    const fragment = resolveOutputFragment(meta, paramKey);
    if (fragment && isRecord(fragment)) {
      walkReceiveSchemaLeaves(paramKey, fragment, 0, leaves);
    }
  }

  const deduped: BackendReceiveParamLeaf[] = [];
  for (const leaf of leaves) {
    if (seen.has(leaf.path)) continue;
    seen.add(leaf.path);
    deduped.push(leaf);
  }
  deduped.sort((a, b) => a.path.localeCompare(b.path));
  return deduped;
}

export function buildReceivePathAllowlist(
  leaves: readonly BackendReceiveParamLeaf[]
): ReadonlySet<string> {
  return new Set(leaves.map((l) => l.path.trim()));
}
