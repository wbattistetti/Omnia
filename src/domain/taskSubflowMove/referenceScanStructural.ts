/**
 * §3 reference scan: token-based UUID extraction and structural walks of flow / task JSON.
 * No per-known-id substring search (haystack.includes(varId)).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { parseTranslationKey } from '@utils/translationKeys';
import { taskRepository } from '@services/TaskRepository';
import { REFERENCE_SCAN_INTERNAL_TEXT_KEY } from './internalReferenceHaystack';

/** RFC UUID tokens in text (global). */
export const UUID_TOKEN_RE =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g;

/** Frontend {@link generateSafeGuid} tokens (global). */
const SAFE_GUID_TOKEN_RE = /\bg_[a-f0-9]{32}\b/gi;

const MAX_TASK_WALK_DEPTH = 48;
const MAX_TASK_WALK_NODES = 8000;

/**
 * Maps lowercase UUID string → canonical id from the project set (preserves casing of first seen).
 */
export function buildLowercaseToCanonicalVarIdMap(knownVarIds: ReadonlySet<string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const id of knownVarIds) {
    const t = String(id || '').trim();
    if (!t) continue;
    const lo = t.toLowerCase();
    if (!m.has(lo)) m.set(lo, t);
  }
  return m;
}

/**
 * Finds variable references in free text by scanning for RFC UUID tokens and keeping those in the known set.
 * Replaces legacy haystack.includes(perVarId).
 */
export function extractKnownVarIdsFromText(
  text: string,
  lowercaseToCanonical: Map<string, string>
): Set<string> {
  const out = new Set<string>();
  if (!text || lowercaseToCanonical.size === 0) return out;
  const reUuid = new RegExp(UUID_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = reUuid.exec(text)) !== null) {
    const canon = lowercaseToCanonical.get(m[0].toLowerCase());
    if (canon) out.add(canon);
  }
  const reSafe = new RegExp(SAFE_GUID_TOKEN_RE.source, 'gi');
  while ((m = reSafe.exec(text)) !== null) {
    const canon = lowercaseToCanonical.get(m[0].toLowerCase());
    if (canon) out.add(canon);
  }
  return out;
}

function mergeInto(target: Set<string>, source: Iterable<string>): void {
  for (const x of source) target.add(x);
}

/** Keys whose string values are treated as variable GUIDs when they appear in the known set. */
const DIRECT_VAR_GUID_KEYS = new Set([
  'parentVariableId',
  'variableRefId',
  'interfaceParameterId',
  'dataId',
  /** Task tree: `taskId` equals `varId` for value nodes (§1–2). */
  'taskId',
]);

/**
 * Walks a persisted Task object: string leaves → token extract; known keys → direct id if known.
 * Skips duplicate compile of {@link REFERENCE_SCAN_INTERNAL_TEXT_KEY} body when walking children (handled as string).
 */
export function extractReferencedVarIdsFromTaskObject(
  task: unknown,
  lowercaseToCanonical: Map<string, string>
): Set<string> {
  const out = new Set<string>();
  if (task === null || task === undefined) return out;

  const visit = (v: unknown, depth: number, n: { c: number }): void => {
    if (n.c >= MAX_TASK_WALK_NODES || depth > MAX_TASK_WALK_DEPTH) return;
    n.c += 1;
    if (v === null || v === undefined) return;

    if (typeof v === 'string') {
      mergeInto(out, extractKnownVarIdsFromText(v, lowercaseToCanonical));
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return;

    if (Array.isArray(v)) {
      for (const x of v) {
        visit(x, depth + 1, n);
        if (n.c >= MAX_TASK_WALK_NODES) return;
      }
      return;
    }

    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const [k, val] of Object.entries(o)) {
        if (DIRECT_VAR_GUID_KEYS.has(k) && typeof val === 'string') {
          const t = val.trim();
          if (t && lowercaseToCanonical.has(t.toLowerCase())) {
            out.add(lowercaseToCanonical.get(t.toLowerCase())!);
          }
        }
        if (k === 'subflowBindings' && Array.isArray(val)) {
          for (const row of val) {
            if (!row || typeof row !== 'object') continue;
            const r = row as { interfaceParameterId?: string; parentVariableId?: string };
            for (const key of ['interfaceParameterId', 'parentVariableId'] as const) {
              const s = String(r[key] || '').trim();
              if (s && lowercaseToCanonical.has(s.toLowerCase())) {
                out.add(lowercaseToCanonical.get(s.toLowerCase())!);
              }
            }
          }
          continue;
        }
        visit(val, depth + 1, n);
        if (n.c >= MAX_TASK_WALK_NODES) return;
      }
    }
  };

  visit(task, 0, { c: 0 });
  return out;
}

function extractFromMappingEntries(
  rows: unknown,
  lowercaseToCanonical: Map<string, string>,
  out: Set<string>
): void {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const vid = String((row as { variableRefId?: string }).variableRefId || '').trim();
    if (vid && lowercaseToCanonical.has(vid.toLowerCase())) {
      out.add(lowercaseToCanonical.get(vid.toLowerCase())!);
    }
  }
}

function extractFromTranslationMeta(
  translations: Record<string, string | Record<string, string>> | undefined,
  lowercaseToCanonical: Map<string, string>,
  out: Set<string>
): void {
  if (!translations || typeof translations !== 'object') return;
  for (const [key, val] of Object.entries(translations)) {
    const pk = parseTranslationKey(key);
    if (pk?.kind === 'var' && lowercaseToCanonical.has(pk.guid.toLowerCase())) {
      out.add(lowercaseToCanonical.get(pk.guid.toLowerCase())!);
    }
    if (typeof val === 'string' && val) {
      mergeInto(out, extractKnownVarIdsFromText(val, lowercaseToCanonical));
    }
  }
}

function extractFromFlowBindings(
  bindings: unknown,
  lowercaseToCanonical: Map<string, string>,
  out: Set<string>
): void {
  if (!Array.isArray(bindings)) return;
  for (const b of bindings) {
    if (!b || typeof b !== 'object') continue;
    const row = b as { interfaceParameterId?: string; parentVariableId?: string };
    for (const k of ['interfaceParameterId', 'parentVariableId'] as const) {
      const s = String(row[k] || '').trim();
      if (s && lowercaseToCanonical.has(s.toLowerCase())) {
        out.add(lowercaseToCanonical.get(s.toLowerCase())!);
      }
    }
  }
}

/**
 * Walks edge objects (transitions, labels): only RFC UUID tokens in string fields count.
 */
function extractFromEdgesStructural(
  edges: unknown,
  lowercaseToCanonical: Map<string, string>,
  out: Set<string>
): void {
  if (!Array.isArray(edges)) return;
  const visitVal = (v: unknown, depth: number, n: { c: number }): void => {
    if (n.c > 4000 || depth > 24) return;
    n.c += 1;
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      mergeInto(out, extractKnownVarIdsFromText(v, lowercaseToCanonical));
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return;
    if (Array.isArray(v)) {
      for (const x of v) visitVal(x, depth + 1, n);
      return;
    }
    if (typeof v === 'object') {
      for (const x of Object.values(v as Record<string, unknown>)) visitVal(x, depth + 1, n);
    }
  };
  for (const e of edges) {
    visitVal(e, 0, { c: 0 });
  }
}

/**
 * Collects variable refs from the parent flow slice: meta (interface, translations, bindings), edges, canvas tasks.
 */
export function extractReferencedVarIdsFromParentFlowStructure(
  parentFlowId: string,
  flows: WorkspaceState['flows'],
  lowercaseToCanonical: Map<string, string>
): Set<string> {
  const out = new Set<string>();
  const flow = flows[parentFlowId];
  if (!flow) return out;

  const meta = flow.meta as
    | {
        flowInterface?: { input?: unknown[]; output?: unknown[] };
        translations?: Record<string, string | Record<string, string>>;
      }
    | undefined;

  if (meta?.flowInterface) {
    extractFromMappingEntries(meta.flowInterface.input, lowercaseToCanonical, out);
    extractFromMappingEntries(meta.flowInterface.output, lowercaseToCanonical, out);
  }
  extractFromTranslationMeta(meta?.translations, lowercaseToCanonical, out);
  extractFromFlowBindings((flow as { bindings?: unknown }).bindings, lowercaseToCanonical, out);

  extractFromEdgesStructural(flow.edges, lowercaseToCanonical, out);

  const nodes = (flow.nodes || []) as Array<{ data?: { rows?: Array<{ id?: string }> } }>;
  for (const node of nodes) {
    const rows = node?.data?.rows;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const tid = String(row?.id || '').trim();
      if (!tid) continue;
      const task = taskRepository.getTask(tid);
      if (task) {
        mergeInto(out, extractReferencedVarIdsFromTaskObject(task, lowercaseToCanonical));
      }
    }
  }

  const embeddedTasks = (flow as { tasks?: unknown[] }).tasks;
  if (Array.isArray(embeddedTasks)) {
    for (const t of embeddedTasks) {
      mergeInto(out, extractReferencedVarIdsFromTaskObject(t, lowercaseToCanonical));
    }
  }

  return out;
}

/**
 * Parses optional JSON extra chunks: uses only {@link REFERENCE_SCAN_INTERNAL_TEXT_KEY} when object; else token-scans the string.
 */
export function extractReferencedVarIdsFromExtraCorpusChunks(
  chunks: readonly string[] | undefined,
  lowercaseToCanonical: Map<string, string>
): Set<string> {
  const out = new Set<string>();
  if (!chunks?.length) return out;
  for (const chunk of chunks) {
    if (!chunk) continue;
    try {
      const parsed = JSON.parse(chunk) as Record<string, unknown>;
      const p = parsed[REFERENCE_SCAN_INTERNAL_TEXT_KEY];
      if (typeof p === 'string' && p.trim()) {
        mergeInto(out, extractKnownVarIdsFromText(p, lowercaseToCanonical));
      }
      mergeInto(out, extractReferencedVarIdsFromTaskObject(parsed, lowercaseToCanonical));
    } catch {
      mergeInto(out, extractKnownVarIdsFromText(chunk, lowercaseToCanonical));
    }
  }
  return out;
}

/**
 * Translation values compiled to GUID form: token scan.
 */
export function extractReferencedVarIdsFromTranslationsInternal(
  translationsInternal: Record<string, string> | undefined,
  lowercaseToCanonical: Map<string, string>
): Set<string> {
  const out = new Set<string>();
  if (!translationsInternal || typeof translationsInternal !== 'object') return out;
  for (const v of Object.values(translationsInternal)) {
    if (v) mergeInto(out, extractKnownVarIdsFromText(String(v), lowercaseToCanonical));
  }
  return out;
}
