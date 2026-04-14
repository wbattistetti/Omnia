/**
 * Single policy for GUID → visible label across Interface, canvas tokens, menus, and cross-flow refs.
 * Translation keys are **only** `var:<guid>`; legacy `interface:<guid>` in persisted flow meta is read for display until migrated.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import {
  flattenFlowMetaTranslations,
  getActiveFlowMetaTranslationsFlattened,
  getFlowMetaTranslationsFlattened,
} from './activeFlowTranslations';
import { isUuidString, makeTranslationKey } from './translationKeys';
import { resolveTranslationEntryValue, type TranslationEntryValue } from './resolveTranslationEntry';

export type DisplayContext =
  | 'flowInterfaceOutput'
  | 'flowCanvasToken'
  | 'menuVariables'
  | 'crossFlowReference';

export type ResolveVariableDisplayNameOptions = {
  /** Flattened `flow.meta.translations` for the relevant flow (keys `var:<guid>` and legacy `interface:<guid>`). */
  flowMetaTranslations?: Record<string, string>;
  /** Project-wide compiled map (same as {@link ProjectTranslationsContext}.compiledTranslations). */
  compiledTranslations?: Record<string, string> | null;
};

/** Returns the last path segment after `.`, or the whole string if no dot (leaf label). */
export function leafFromQualifiedDisplayName(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return s;
  const parts = s.split('.');
  const last = parts[parts.length - 1];
  return String(last || s).trim() || s;
}

function resolvedString(v: TranslationEntryValue | string | undefined | null): string {
  if (v == null) return '';
  return resolveTranslationEntryValue(typeof v === 'object' && v !== null && !Array.isArray(v) ? v : String(v));
}

/**
 * Resolves a variable GUID to the display string for the given UI context.
 */
export function resolveVariableDisplayName(
  guid: string,
  context: DisplayContext,
  opts: ResolveVariableDisplayNameOptions = {}
): string {
  const id = String(guid || '').trim();
  if (!id) return '';
  if (!isUuidString(id)) return id;

  const varKey = makeTranslationKey('var', id);
  const legacyIfaceKey = makeTranslationKey('interface', id);
  const flowTr = opts.flowMetaTranslations ?? {};
  const compiled = opts.compiledTranslations ?? {};

  switch (context) {
    case 'flowInterfaceOutput': {
      const vVar = flowTr[varKey];
      if (vVar != null && String(resolvedString(vVar as TranslationEntryValue)).trim() !== '') {
        return leafFromQualifiedDisplayName(resolvedString(vVar as TranslationEntryValue));
      }
      const vLegacy = flowTr[legacyIfaceKey];
      if (vLegacy != null && String(resolvedString(vLegacy as TranslationEntryValue)).trim() !== '') {
        return leafFromQualifiedDisplayName(resolvedString(vLegacy as TranslationEntryValue));
      }
      const cVar = compiled[varKey];
      if (cVar != null && String(resolvedString(cVar as TranslationEntryValue)).trim() !== '') {
        return leafFromQualifiedDisplayName(resolvedString(cVar as TranslationEntryValue));
      }
      const cLegacy = compiled[legacyIfaceKey];
      if (cLegacy != null && String(resolvedString(cLegacy as TranslationEntryValue)).trim() !== '') {
        return leafFromQualifiedDisplayName(resolvedString(cLegacy as TranslationEntryValue));
      }
      return id;
    }
    case 'flowCanvasToken': {
      const vVar = flowTr[varKey];
      if (vVar != null && String(resolvedString(vVar as TranslationEntryValue)).trim() !== '') {
        return resolvedString(vVar as TranslationEntryValue);
      }
      const cVar = compiled[varKey];
      if (cVar != null && String(resolvedString(cVar as TranslationEntryValue)).trim() !== '') {
        return resolvedString(cVar as TranslationEntryValue);
      }
      const vLegacy = flowTr[legacyIfaceKey];
      if (vLegacy != null && String(resolvedString(vLegacy as TranslationEntryValue)).trim() !== '') {
        return resolvedString(vLegacy as TranslationEntryValue);
      }
      const cLegacy = compiled[legacyIfaceKey];
      if (cLegacy != null && String(resolvedString(cLegacy as TranslationEntryValue)).trim() !== '') {
        return resolvedString(cLegacy as TranslationEntryValue);
      }
      return id;
    }
    case 'menuVariables':
    case 'crossFlowReference': {
      const cVar = compiled[varKey];
      if (cVar != null && String(resolvedString(cVar as TranslationEntryValue)).trim() !== '') {
        return resolvedString(cVar as TranslationEntryValue);
      }
      const vVar = flowTr[varKey];
      if (vVar != null && String(resolvedString(vVar as TranslationEntryValue)).trim() !== '') {
        return resolvedString(vVar as TranslationEntryValue);
      }
      const cLegacy = compiled[legacyIfaceKey];
      if (cLegacy != null && String(resolvedString(cLegacy as TranslationEntryValue)).trim() !== '') {
        return resolvedString(cLegacy as TranslationEntryValue);
      }
      const vLegacy = flowTr[legacyIfaceKey];
      if (vLegacy != null && String(resolvedString(vLegacy as TranslationEntryValue)).trim() !== '') {
        return resolvedString(vLegacy as TranslationEntryValue);
      }
      return id;
    }
    default:
      return id;
  }
}

/**
 * Interface INPUT/OUTPUT tree leaf: `var:` / legacy / compiled like {@link resolveVariableDisplayName},
 * then task row text on the canvas when the flow document is available (`flows[flowCanvasId]`).
 * Pass `flows` from the live workspace store so labels stay aligned with `FlowStore` (avoids snapshot lag).
 */
export function interfaceOutputLeafDisplayName(
  vid: string,
  flowCanvasId: string | undefined,
  flows: WorkspaceState['flows'] | undefined,
  compiledTranslations: Record<string, string> | null | undefined
): string {
  const id = String(vid || '').trim();
  if (!id) return '';
  const fid = String(flowCanvasId || '').trim();

  const flat: Record<string, string> =
    fid && flows?.[fid]
      ? flattenFlowMetaTranslations(flows[fid])
      : fid
        ? getFlowMetaTranslationsFlattened(fid)
        : getActiveFlowMetaTranslationsFlattened();

  const r = resolveVariableDisplayName(id, 'flowInterfaceOutput', {
    flowMetaTranslations: flat,
    compiledTranslations: compiledTranslations ?? {},
  });
  if (r !== id) return r;

  if (fid && flows?.[fid]) {
    const rowText = findTaskRowTextForTaskId(flows[fid], id);
    if (rowText) return leafFromQualifiedDisplayName(rowText);
  }

  return id;
}

/** Optional sources when the child flow slice has no canvas row or `var:` yet (first move into subflow). */
export type LeafLabelForNewInterfaceRowOptions = {
  /** Parent flow id: same taskId row text is read when the child canvas is still empty in the snapshot. */
  parentFlowId?: string;
  /** Compiled project map (`var:<guid>`); callers typically pass `getProjectTranslationsTable()`. */
  compiledProjectTranslations?: Record<string, string> | null;
};

/**
 * Leaf label for a new Interface OUTPUT/INPUT row: child `var:` in `existingFlowTranslations`, then task row on the
 * child canvas, then parent canvas row, then compiled project `var:`, else §4C short fallback (not raw GUID).
 */
export function leafLabelForNewInterfaceOutputRow(
  vid: string,
  childFlowId: string,
  flows: WorkspaceState['flows'],
  existingFlowTranslations: Record<string, string>,
  options?: LeafLabelForNewInterfaceRowOptions
): string {
  const id = String(vid || '').trim();
  if (!id || !isUuidString(id)) return id;

  const varKey = makeTranslationKey('var', id);
  const existing = existingFlowTranslations[varKey];
  if (existing != null && String(resolvedString(existing as TranslationEntryValue)).trim() !== '') {
    return leafFromQualifiedDisplayName(resolvedString(existing as TranslationEntryValue));
  }

  const rowTextChild = findTaskRowTextForTaskId(flows[childFlowId], id);
  if (rowTextChild) {
    return leafFromQualifiedDisplayName(rowTextChild);
  }

  const parentFid = String(options?.parentFlowId || '').trim();
  if (parentFid && parentFid !== String(childFlowId || '').trim()) {
    const rowTextParent = findTaskRowTextForTaskId(flows[parentFid], id);
    if (rowTextParent) {
      return leafFromQualifiedDisplayName(rowTextParent);
    }
  }

  const compiled = options?.compiledProjectTranslations ?? null;
  if (compiled && typeof compiled === 'object') {
    const fromProject = resolveVariableDisplayName(id, 'flowInterfaceOutput', {
      flowMetaTranslations: {},
      compiledTranslations: compiled,
    });
    if (fromProject !== id) {
      return leafFromQualifiedDisplayName(fromProject);
    }
  }

  return leafLabelFallbackWithoutRawGuid(id);
}

/**
 * §4C: interface rows should not use the full RFC UUID as the sole visible label when no translation/row text exists.
 */
export function leafLabelFallbackWithoutRawGuid(guid: string): string {
  const id = String(guid || '').trim();
  if (!id) return '';
  const compact = id.replace(/-/g, '');
  const tail = compact.slice(-6);
  return `Variable (${tail})`;
}

function findTaskRowTextForTaskId(
  flow: WorkspaceState['flows'][string] | undefined,
  taskId: string
): string | null {
  if (!flow?.nodes?.length) return null;
  const tid = String(taskId || '').trim();
  for (const node of flow.nodes as Array<{ data?: { rows?: Array<{ id?: string; text?: string }> } }>) {
    const rows = node?.data?.rows;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (String(row?.id || '').trim() === tid) {
        const t = String(row?.text || '').trim();
        return t || null;
      }
    }
  }
  return null;
}
