/**
 * Task move: copy flow-local meta.translations entries from origin slice to child (clone), optional key removal on origin.
 */

import type { Task } from '@types/taskTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import type { VariableInstance } from '@types/variableTypes';
import { collectSayMessageTranslationKeysFromTask } from './collectSayMessageTranslationKeys';
import { stripLegacyVariablesFromFlowMeta } from '@flows/flowMetaSanitize';
import { isUuidString, makeTranslationKey, parseTranslationKey } from '@utils/translationKeys';

export type TranslationEntry = string | Record<string, string>;

/**
 * Resolves which concrete keys exist in `flow.meta.translations` for a hint (canonical `kind:uuid` or bare uuid).
 */
export function resolveTranslationKeysInFlow(
  flow: WorkspaceState['flows'][string] | null | undefined,
  keyOrGuid: string
): string[] {
  const hint = String(keyOrGuid || '').trim();
  if (!hint) return [];
  const meta = flow?.meta?.translations;
  if (!meta || typeof meta !== 'object') return [];

  if (Object.prototype.hasOwnProperty.call(meta, hint)) {
    return [hint];
  }

  const parsed = parseTranslationKey(hint);
  if (parsed) {
    return Object.prototype.hasOwnProperty.call(meta, hint) ? [hint] : [];
  }

  if (!isUuidString(hint)) return [];

  const g = hint.toLowerCase();
  const found: string[] = [];
  for (const k of Object.keys(meta)) {
    const p = parseTranslationKey(k);
    if (p && p.guid.toLowerCase() === g) {
      found.push(k);
    } else if (k.toLowerCase() === g) {
      found.push(k);
    }
  }
  return found;
}

/**
 * Returns a shallow copy of translation entries for the given keys (resolved per {@link resolveTranslationKeysInFlow}).
 */
export function getTranslationsForKeys(
  flow: WorkspaceState['flows'][string] | null | undefined,
  keys: Iterable<string>
): Record<string, TranslationEntry> {
  const out: Record<string, TranslationEntry> = {};
  const seen = new Set<string>();
  for (const k of keys) {
    for (const rk of resolveTranslationKeysInFlow(flow, k)) {
      if (seen.has(rk)) continue;
      seen.add(rk);
      const v = flow?.meta?.translations?.[rk];
      if (v === undefined) continue;
      out[rk] =
        typeof v === 'object' && v !== null && !Array.isArray(v)
          ? { ...(v as Record<string, string>) }
          : String(v);
    }
  }
  return out;
}

export class CloneTranslationsCollisionError extends Error {
  constructor(
    public readonly childFlowId: string,
    public readonly keys: string[]
  ) {
    super(`cloneTranslationsToChild: child already has different value for keys: ${keys.join(', ')}`);
    this.name = 'CloneTranslationsCollisionError';
  }
}

function translationEntryEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (a != null && b != null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Logical keys to copy: SayMessage store keys + `var:` for each task variable row.
 */
export function buildTranslationKeysForTaskMove(
  task: Task | null | undefined,
  taskVariableRows: readonly VariableInstance[]
): Set<string> {
  const messageKeys = collectSayMessageTranslationKeysFromTask(task ?? undefined);
  const varKeys = varTranslationKeysForIds(taskVariableRows.map((v) => String(v.id || '').trim()));
  return new Set<string>([...messageKeys, ...varKeys]);
}

/**
 * Copies translation entries from origin flow slice to child slice 1:1.
 * If a key already exists on the child with the **same** value, the copy is skipped (idempotent).
 * Throws {@link CloneTranslationsCollisionError} only when the same key exists with a **different** value.
 */
export function cloneTranslationsToChild(
  flows: WorkspaceState['flows'],
  originFlowId: string,
  childFlowId: string,
  logicalKeys: ReadonlySet<string>
): WorkspaceState['flows'] {
  const oId = String(originFlowId || '').trim();
  const cId = String(childFlowId || '').trim();
  if (!oId || !cId || oId === cId) return flows;

  const origin = flows[oId];
  const child = flows[cId];
  if (!origin || !child) return flows;

  const srcTr = origin.meta?.translations;
  if (!srcTr || typeof srcTr !== 'object') {
    return flows;
  }

  const prevChildTr =
    child.meta?.translations && typeof child.meta.translations === 'object'
      ? { ...(child.meta.translations as Record<string, TranslationEntry>) }
      : ({} as Record<string, TranslationEntry>);

  const resolvedKeysToCopy: string[] = [];
  for (const logical of logicalKeys) {
    const resolved = resolveTranslationKeysInFlow(origin, logical);
    for (const rk of resolved) {
      if (!(rk in srcTr)) continue;
      resolvedKeysToCopy.push(rk);
    }
  }
  const unique = [...new Set(resolvedKeysToCopy)];

  const mismatch: string[] = [];
  for (const rk of unique) {
    if (!Object.prototype.hasOwnProperty.call(prevChildTr, rk)) continue;
    const fromOrigin = (srcTr as Record<string, unknown>)[rk];
    const onChild = prevChildTr[rk];
    if (!translationEntryEqual(onChild, fromOrigin)) {
      mismatch.push(rk);
    }
  }
  if (mismatch.length > 0) {
    throw new CloneTranslationsCollisionError(cId, mismatch);
  }

  let addedAny = false;
  for (const rk of unique) {
    if (Object.prototype.hasOwnProperty.call(prevChildTr, rk)) {
      continue;
    }
    addedAny = true;
    const v = (srcTr as Record<string, unknown>)[rk];
    prevChildTr[rk] =
      typeof v === 'object' && v !== null && !Array.isArray(v)
        ? { ...(v as Record<string, string>) }
        : String(v ?? '');
  }

  if (!addedAny) {
    return flows;
  }

  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...(child.meta || {}),
    translations: prevChildTr,
  }) as typeof child.meta;

  return {
    ...flows,
    [cId]: { ...child, meta: nextMeta, hasLocalChanges: true },
  };
}

/**
 * Removes translation keys from a single flow slice (e.g. parent cleanup). Does not throw if key is absent.
 */
export function removeTranslationKeysFromFlowSlice(
  flows: WorkspaceState['flows'],
  flowId: string,
  keysToRemove: ReadonlySet<string>
): WorkspaceState['flows'] {
  const fid = String(flowId || '').trim();
  if (!fid || keysToRemove.size === 0) return flows;
  const flow = flows[fid];
  if (!flow?.meta?.translations || typeof flow.meta.translations !== 'object') return flows;

  const tr = { ...(flow.meta.translations as Record<string, unknown>) };
  let changed = false;
  for (const k of keysToRemove) {
    if (Object.prototype.hasOwnProperty.call(tr, k)) {
      delete tr[k];
      changed = true;
    }
  }
  if (!changed) return flows;

  const nextMeta = stripLegacyVariablesFromFlowMeta({
    ...(flow.meta || {}),
    translations: tr as Record<string, TranslationEntry>,
  }) as typeof flow.meta;

  return {
    ...flows,
    [fid]: { ...flow, meta: nextMeta, hasLocalChanges: true },
  };
}

/**
 * Builds canonical `var:<guid>` keys for variable instance ids.
 */
export function varTranslationKeysForIds(varIds: Iterable<string>): string[] {
  const out: string[] = [];
  for (const id of varIds) {
    const vid = String(id || '').trim();
    if (!vid || !isUuidString(vid)) continue;
    try {
      out.push(makeTranslationKey('var', vid));
    } catch {
      /* skip */
    }
  }
  return [...new Set(out)];
}
