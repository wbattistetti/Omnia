/**
 * Righe contratto OpenAPI per parametro (SEND/RECEIVE) nella sintesi USE OF BACKENDS.
 */

import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import type { OpenApiParamPathHint } from '@services/openApiParamPathHints';
import { TaskType, type Task } from '@types/taskTypes';
import type { BackendCallWireParam } from '@domain/backendAnalysis/realignBackendParametersFromOpenApiTask';
import { collectParamKeysFromBackendCallTask } from '@domain/backendAnalysis/realignBackendParametersFromOpenApiTask';
import {
  collectOpenApiCompileErrors,
  type OpenApiCompileValidationInput,
} from './collectOpenApiCompileErrors';
import { summarizeOpenApiSchemaFragment } from './summarizeOpenApiSchemaFragment';
import { buildOpenApiConvaiContractPreambleLines } from './convaiOptionalFieldSemantics';

export const OPENAPI_CONTRACT_MISSING_PREFIX = 'MISSING:';

export type OpenApiParamContractLine = {
  paramKey: string;
  direction: 'input' | 'output';
  contractText: string;
  missing: boolean;
  nestedLines: Array<{ path: string; text: string; missing: boolean }>;
};

const SPEC_SUFFIX = ' — spec incompleta';
const MAX_NESTED_PROPS = 24;
const MAX_NESTED_DEPTH = 2;

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

function hintToSchemaFragment(hint: OpenApiParamPathHint): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (hint.type) o.type = hint.type;
  if (hint.format) o.format = hint.format;
  if (hint.enum?.length) o.enum = [...hint.enum];
  return o;
}

function mergedJsonSchemas(meta: BackendCallSpecMeta): Record<string, Record<string, unknown>> {
  return {
    ...(meta.openapiOutputJsonSchemaByApiName ?? {}),
    ...(meta.openapiInputJsonSchemaByApiName ?? {}),
  };
}

function validationInputFromMeta(meta: BackendCallSpecMeta): OpenApiCompileValidationInput {
  const jsonSchemasByApiName = mergedJsonSchemas(meta);
  return {
    jsonSchemasByApiName,
    paramUiKindsByApiName: meta.openapiInputUiKindByApiName,
    paramEnumsByApiName: meta.openapiInputEnumByApiName,
  };
}

function contractForSchema(
  path: string,
  schema: unknown,
  issuesByPath: Map<string, string>
): { text: string; missing: boolean } {
  const issue = issuesByPath.get(path);
  if (issue) {
    return { text: `${OPENAPI_CONTRACT_MISSING_PREFIX} ${issue}`, missing: true };
  }
  const summary = summarizeOpenApiSchemaFragment(schema);
  if (summary) return { text: summary, missing: false };
  return { text: `${OPENAPI_CONTRACT_MISSING_PREFIX} schema senza type`, missing: true };
}

function resolveFragment(
  meta: BackendCallSpecMeta,
  paramKey: string,
  direction: 'input' | 'output'
): Record<string, unknown> | undefined {
  const fromJson =
    direction === 'input'
      ? meta.openapiInputJsonSchemaByApiName?.[paramKey]
      : meta.openapiOutputJsonSchemaByApiName?.[paramKey];
  if (fromJson && isRecord(fromJson)) return fromJson;

  const hints =
    direction === 'input'
      ? meta.openapiParamHintsByPath?.inputs
      : meta.openapiParamHintsByPath?.outputs;
  const hint = hints?.[paramKey];
  if (hint && (hint.type || hint.format || hint.enum?.length)) {
    return hintToSchemaFragment(hint);
  }
  return undefined;
}

/** Espande proprietà annidate sotto un parametro object (es. constraints.*). */
function buildNestedLinesFromSchema(
  rootKey: string,
  fragment: Record<string, unknown>,
  issuesByPath: Map<string, string>
): OpenApiParamContractLine['nestedLines'] {
  const lines: OpenApiParamContractLine['nestedLines'] = [];
  const seen = new Set<string>();

  const push = (path: string, text: string, missing: boolean) => {
    if (seen.has(path)) return;
    seen.add(path);
    lines.push({ path, text, missing });
  };

  function walkObjectProperties(parentPath: string, props: Record<string, unknown>, depth: number) {
    let count = 0;
    for (const [key, child] of Object.entries(props)) {
      if (count >= MAX_NESTED_PROPS) break;
      count += 1;
      const path = `${parentPath}.${key}`;
      const childIssue = issuesByPath.get(path);
      if (childIssue) {
        push(path, `${OPENAPI_CONTRACT_MISSING_PREFIX} ${childIssue}`, true);
        continue;
      }
      if (!isRecord(child)) {
        push(path, `${OPENAPI_CONTRACT_MISSING_PREFIX} schema assente`, true);
        continue;
      }
      const t = effectiveType(child);
      if (t === 'object' && isRecord(child.properties) && depth < MAX_NESTED_DEPTH) {
        const { text, missing } = contractForSchema(path, child, issuesByPath);
        push(path, text, missing);
        walkObjectProperties(path, child.properties as Record<string, unknown>, depth + 1);
        continue;
      }
      const { text, missing } = contractForSchema(path, child, issuesByPath);
      push(path, text, missing);
    }
  }

  const rootIssue = issuesByPath.get(rootKey);
  const t = effectiveType(fragment);
  if (t === 'object' && isRecord(fragment.properties)) {
    walkObjectProperties(rootKey, fragment.properties as Record<string, unknown>, 0);
  }

  for (const [path, reason] of issuesByPath) {
    if (path === rootKey) continue;
    if (!path.startsWith(`${rootKey}.`) && !path.startsWith(`${rootKey}[`)) continue;
    if (!seen.has(path)) {
      push(path, `${OPENAPI_CONTRACT_MISSING_PREFIX} ${reason}`, true);
    }
  }

  if (rootIssue && !seen.has(rootKey)) {
    push(rootKey, `${OPENAPI_CONTRACT_MISSING_PREFIX} ${rootIssue}`, true);
  }

  lines.sort((a, b) => a.path.localeCompare(b.path));
  return lines;
}

function uiKindToPositiveSummary(
  kind: string,
  enums: Record<string, string[]>,
  apiName: string
): string | null {
  const k = kind.trim().toLowerCase();
  if (k === 'date') return 'type string, format date';
  if (k === 'time') return 'type string, format time';
  if (k === 'datetime-local') return 'type string, format date-time';
  if (k === 'uri') return 'type string, format uri';
  if (k === 'number') return 'type number';
  if (k === 'boolean') return 'type boolean';
  if (k === 'enum') {
    const vals = enums[apiName];
    if (vals?.length) {
      const clip = vals.slice(0, 12).join(', ');
      return `type string, enum: ${clip}${vals.length > 12 ? '…' : ''}`;
    }
    return null;
  }
  return null;
}

function lineForWireParam(
  wp: BackendCallWireParam,
  meta: BackendCallSpecMeta | undefined,
  issuesByPath: Map<string, string>
): OpenApiParamContractLine {
  const { paramKey, direction } = wp;

  if (!meta || meta.importState !== 'ok') {
    return {
      paramKey,
      direction,
      contractText: `${OPENAPI_CONTRACT_MISSING_PREFIX} OpenAPI non importato (Recupera specifiche)`,
      missing: true,
      nestedLines: [],
    };
  }

  const fragment = resolveFragment(meta, paramKey, direction);
  const rootIssue = issuesByPath.get(paramKey);

  if (fragment) {
    const t = effectiveType(fragment);
    const nested =
      t === 'object' && isRecord(fragment.properties)
        ? buildNestedLinesFromSchema(paramKey, fragment, issuesByPath)
        : buildNestedLinesFromSchema(paramKey, fragment, issuesByPath).filter(
            (n) => n.path !== paramKey
          );

    if (rootIssue) {
      return {
        paramKey,
        direction,
        contractText: `${OPENAPI_CONTRACT_MISSING_PREFIX} ${rootIssue}`,
        missing: true,
        nestedLines: nested,
      };
    }

    if (t === 'object' && isRecord(fragment.properties)) {
      const anyNestedMissing = nested.some((n) => n.missing);
      return {
        paramKey,
        direction,
        contractText: 'type object',
        missing: anyNestedMissing,
        nestedLines: nested,
      };
    }

    const summary = summarizeOpenApiSchemaFragment(fragment);
    if (summary) {
      return {
        paramKey,
        direction,
        contractText: summary,
        missing: nested.some((n) => n.missing),
        nestedLines: nested,
      };
    }
    return {
      paramKey,
      direction,
      contractText: `${OPENAPI_CONTRACT_MISSING_PREFIX} schema senza type`,
      missing: true,
      nestedLines: nested,
    };
  }

  if (direction === 'input') {
    const kind = meta.openapiInputUiKindByApiName?.[paramKey];
    const enums = meta.openapiInputEnumByApiName ?? {};
    if (kind) {
      const positive = uiKindToPositiveSummary(kind, enums, paramKey);
      if (positive && !rootIssue) {
        return {
          paramKey,
          direction,
          contractText: positive,
          missing: false,
          nestedLines: [],
        };
      }
    }
  }

  if (rootIssue) {
    return {
      paramKey,
      direction,
      contractText: `${OPENAPI_CONTRACT_MISSING_PREFIX} ${rootIssue}`,
      missing: true,
      nestedLines: [],
    };
  }

  return {
    paramKey,
    direction,
    contractText: `${OPENAPI_CONTRACT_MISSING_PREFIX} nessuno schema OpenAPI per questo parametro`,
    missing: true,
    nestedLines: [],
  };
}

export function buildOpenApiParamContractLines(task: Task): OpenApiParamContractLine[] {
  if (task.type !== TaskType.BackendCall) return [];
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  const issuesByPath = meta ? groupCompileIssuesByPath(validationInputFromMeta(meta)) : new Map();
  const wire = collectParamKeysFromBackendCallTask(task);
  return wire.map((wp) => lineForWireParam(wp, meta, issuesByPath));
}

/** Preamble contratto OpenAPI visibile a designer (USE OF BACKENDS, report). */
export function buildOpenApiParamContractPreamble(): readonly string[] {
  return buildOpenApiConvaiContractPreambleLines();
}

export function collectOpenApiCompileErrorMessages(task: Task): string[] {
  if (task.type !== TaskType.BackendCall) return [];
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  if (!meta || meta.importState !== 'ok') return [];
  return collectOpenApiCompileErrors(validationInputFromMeta(meta));
}
