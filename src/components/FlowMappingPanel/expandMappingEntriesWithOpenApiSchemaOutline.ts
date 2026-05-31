/**
 * Espande la firma SEND/RECEIVE con nodi virtuali da schema OpenAPI annidato (solo UI Signature).
 * I nodi `schemaOutlineOnly` non vengono persistiti sul task.
 */

import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import { createMappingEntry, type MappingEntry } from './mappingTypes';

const MAX_DEPTH = 6;
const MAX_OUTLINE_NODES = 96;

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

function formatLabelFromSchema(schema: Record<string, unknown>): string {
  const t = effectiveType(schema);
  const format = typeof schema.format === 'string' ? schema.format.trim() : '';
  if (t === 'array' && isRecord(schema.items)) {
    const itemT = effectiveType(schema.items);
    const itemF = typeof schema.items.format === 'string' ? schema.items.format.trim() : '';
    if (itemT && itemF) return `array · ${itemT} (${itemF})`;
    if (itemT) return `array · ${itemT}`;
    return 'array';
  }
  if (format) return `${t} (${format})`;
  return t || 'unknown';
}

function addOutlineEntry(
  wireKey: string,
  schema: Record<string, unknown>,
  out: MappingEntry[],
  seen: Set<string>
): void {
  if (out.length >= MAX_OUTLINE_NODES || seen.has(wireKey)) return;
  seen.add(wireKey);
  const desc =
    typeof schema.description === 'string' && schema.description.trim()
      ? schema.description.trim()
      : undefined;
  const leaf = wireKey.includes('.') ? wireKey.slice(wireKey.lastIndexOf('.') + 1) : wireKey;
  out.push(
    createMappingEntry({
      wireKey,
      apiField: leaf,
      schemaOutlineOnly: true,
      ...(desc ? { fieldDescription: desc } : {}),
      openapiFormatLabel: formatLabelFromSchema(schema),
    })
  );
}

function walkSchemaOutline(
  pathPrefix: string,
  schema: Record<string, unknown>,
  depth: number,
  existingWireKeys: Set<string>,
  out: MappingEntry[],
  seen: Set<string>
): void {
  if (depth > MAX_DEPTH || out.length >= MAX_OUTLINE_NODES) return;
  const t = effectiveType(schema);

  if (t === 'object' && isRecord(schema.properties)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (!isRecord(child)) continue;
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      walkSchemaOutline(childPath, child, depth + 1, existingWireKeys, out, seen);
    }
    return;
  }

  if (t === 'array') {
    if (pathPrefix && !existingWireKeys.has(pathPrefix)) {
      addOutlineEntry(pathPrefix, schema, out, seen);
    }
    if (isRecord(schema.items)) {
      walkSchemaOutline(pathPrefix, schema.items, depth + 1, existingWireKeys, out, seen);
    }
    return;
  }

  if (!pathPrefix || !t || t === 'object') return;
  if (existingWireKeys.has(pathPrefix)) return;
  addOutlineEntry(pathPrefix, schema, out, seen);
}

function resolveFragment(
  meta: BackendCallSpecMeta,
  apiParam: string,
  column: 'send' | 'receive'
): Record<string, unknown> | undefined {
  const fromJson =
    column === 'send'
      ? meta.openapiInputJsonSchemaByApiName?.[apiParam]
      : meta.openapiOutputJsonSchemaByApiName?.[apiParam];
  return fromJson && isRecord(fromJson) ? fromJson : undefined;
}

/**
 * Aggiunge righe virtuali per proprietà annidate OpenAPI sotto parametri object/array già wire.
 */
export function expandMappingEntriesWithOpenApiSchemaOutline(
  entries: readonly MappingEntry[],
  column: 'send' | 'receive',
  meta: BackendCallSpecMeta | null | undefined
): MappingEntry[] {
  if (!meta || meta.importState !== 'ok') return [...entries];

  const existingWireKeys = new Set(entries.map((e) => e.wireKey.trim()).filter(Boolean));
  const outline: MappingEntry[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.schemaOutlineOnly) continue;
    const apiParam = (entry.apiField || entry.wireKey).trim();
    const wireRoot = entry.wireKey.trim();
    if (!apiParam || !wireRoot) continue;

    const fragment = resolveFragment(meta, apiParam, column);
    if (!fragment) continue;

    const t = effectiveType(fragment);
    if (t === 'object' || t === 'array') {
      walkSchemaOutline(wireRoot, fragment, 0, existingWireKeys, outline, seen);
      for (const o of outline) existingWireKeys.add(o.wireKey);
    }
  }

  if (outline.length === 0) return [...entries];

  return [...entries, ...outline].sort((a, b) => a.wireKey.localeCompare(b.wireKey));
}

/** Filtra nodi solo-schema prima del persist task. */
export function stripSchemaOutlineMappingEntries(entries: readonly MappingEntry[]): MappingEntry[] {
  return entries.filter((e) => !e.schemaOutlineOnly);
}
