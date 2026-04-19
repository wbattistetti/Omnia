/**
 * When loadFlow returns an empty graph but the workspace slice already has nodes from an
 * in-memory edit (e.g. task → subflow move not yet persisted), avoid replacing local state.
 */

import type { Flow, FlowId } from './FlowTypes';

type MetaTranslations = NonNullable<Flow['meta']>['translations'];

/**
 * Merges `meta.translations` key-by-key so inbound upserts (e.g. Dock subflow sync) cannot replace
 * the entire table and drop keys that exist only on the local slice (stale snapshot problem).
 *
 * - Keys present on one side only: keep that entry.
 * - Same key on both sides: INCOMING (server/new) wins — never discard a fresh write.
 *
 * Rationale: preserving local-only keys protects against Dock layout upserts that send
 * `meta.translations = {}`. On conflict, incoming always wins so that `writeTranslationToFlowSlice`
 * updates are never silently rolled back by an older local value.
 */
export function mergeMetaTranslationTables(
  localT: MetaTranslations,
  serverT: MetaTranslations
): MetaTranslations | undefined {
  const L = localT && typeof localT === 'object' ? localT : undefined;
  const S = serverT && typeof serverT === 'object' ? serverT : undefined;
  if (!L && !S) return undefined;
  const lRec = (L ?? {}) as Record<string, string | Record<string, string>>;
  const sRec = (S ?? {}) as Record<string, string | Record<string, string>>;
  const keys = new Set([...Object.keys(lRec), ...Object.keys(sRec)]);
  if (keys.size === 0) return undefined;
  const out: Record<string, string | Record<string, string>> = {};
  for (const k of keys) {
    const hasL = Object.prototype.hasOwnProperty.call(lRec, k);
    const hasS = Object.prototype.hasOwnProperty.call(sRec, k);
    if (hasL && hasS) {
      out[k] = sRec[k]!; // incoming wins: fresh writes must not be rolled back
    } else {
      out[k] = hasL ? lRec[k]! : sRec[k]!;
    }
  }
  return Object.keys(out).length > 0 ? (out as MetaTranslations) : undefined;
}

/**
 * After `loadFlow`, merge server `meta` with the slice already in memory.
 * When S2 (or the user) has populated `meta.flowInterface` but the server document is older
 * or has empty interface rows, preserve the richer local interface so the UI is not wiped
 * before the next save.
 */
export function mergeFlowMetaOnServerLoad(params: {
  flowId: FlowId;
  localMeta: Flow['meta'] | undefined;
  serverMeta: Flow['meta'] | undefined;
  hasLocalChanges: boolean | undefined;
}): Flow['meta'] | undefined {
  const { flowId, localMeta, serverMeta, hasLocalChanges } = params;
  if (serverMeta === undefined) {
    return localMeta;
  }
  const local = (localMeta && typeof localMeta === 'object' ? localMeta : {}) as NonNullable<Flow['meta']>;
  const server = (serverMeta && typeof serverMeta === 'object' ? serverMeta : {}) as NonNullable<Flow['meta']>;
  const merged: Flow['meta'] = { ...local, ...server };

  const mergedTranslations = mergeMetaTranslationTables(
    local.translations,
    server.translations
  );
  if (mergedTranslations !== undefined) {
    merged.translations = mergedTranslations;
  } else {
    delete merged.translations;
  }

  const lOut = Array.isArray(local.flowInterface?.output) ? local.flowInterface!.output.length : 0;
  const sOut = Array.isArray(server.flowInterface?.output) ? server.flowInterface!.output.length : 0;
  const lIn = Array.isArray(local.flowInterface?.input) ? local.flowInterface!.input.length : 0;
  const sIn = Array.isArray(server.flowInterface?.input) ? server.flowInterface!.input.length : 0;

  const isSubflow = String(flowId).startsWith('subflow_');
  const allowPreserve = hasLocalChanges === true || isSubflow;

  const serverImpoverished =
    allowPreserve &&
    local.flowInterface &&
    (lOut > sOut || lIn > sIn || (lOut > 0 && sOut === 0));

  if (serverImpoverished) {
    merged.flowInterface = {
      input: Array.isArray(local.flowInterface!.input) ? [...local.flowInterface!.input] : [],
      output: Array.isArray(local.flowInterface!.output) ? [...local.flowInterface!.output] : [],
    };
    const lt = local.translations;
    const st = server.translations;
    if (lt && typeof lt === 'object') {
      merged.translations = { ...(typeof st === 'object' && st ? st : {}), ...lt };
    }
  }

  return merged;
}

export function shouldKeepLocalGraphOnEmptyServerResponse(params: {
  serverNodeCount: number;
  localNodeCount: number;
  hasLocalChanges: boolean | undefined;
  /** When set, empty server response never wipes a non-empty subflow canvas (flags can lag). */
  flowId?: string;
}): boolean {
  const { serverNodeCount, localNodeCount, hasLocalChanges, flowId } = params;
  if (serverNodeCount !== 0 || localNodeCount <= 0) return false;
  if (hasLocalChanges === true) return true;
  const id = String(flowId || '');
  return id.startsWith('subflow_');
}
