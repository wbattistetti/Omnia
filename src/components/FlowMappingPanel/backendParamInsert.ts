/**
 * Insert a new backend mapping row at a tree drop position.
 * Insert index follows depth-first tree order (same as on-screen order), so it stays correct when
 * the flat `entries` array order differs from alphabetical display.
 */

import type { MappingEntry } from './mappingTypes';
import { createMappingEntry } from './mappingTypes';
import {
  entriesInDepthFirstOrder,
  parentPathKey,
  type MappingTreeSiblingOrder,
} from './mappingTreeUtils';

/** MIME type for dragging "new parameter" from SEND/RECEIVE headers. */
export const DND_NEW_BACKEND_PARAM = 'application/x-omnia-new-backend-param';

/** Internal path segment for rows not yet named (hidden in UI; user types real name). */
export const EPHEMERAL_SEGMENT_PREFIX = '__omnia_n_';

export type ParamDropPlacement = 'before' | 'after' | 'child';

export interface ParamDropPosition {
  targetPathKey: string;
  placement: ParamDropPlacement;
}

export interface ComputeBackendParamInsertOptions {
  /** Must match FlowMappingTree so the inserted row appears where the user dropped. */
  siblingOrder?: MappingTreeSiblingOrder;
}

export function isEphemeralNewSegment(segment: string): boolean {
  return segment.startsWith(EPHEMERAL_SEGMENT_PREFIX);
}

/** Indices of entries whose path equals pathKey or is under it (descendants). */
export function subtreeEntryIndices(entries: MappingEntry[], pathKey: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const ip = entries[i].internalPath;
    if (ip === pathKey || ip.startsWith(`${pathKey}.`)) out.push(i);
  }
  return out;
}

/** First path segment under parentPathKey (empty string = root). */
function childSegmentsUnderParent(entries: MappingEntry[], parentPathKey: string): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    const p = e.internalPath;
    if (parentPathKey.length === 0) {
      const seg = p.split('.')[0]?.trim();
      if (seg) set.add(seg);
    } else if (p === parentPathKey || p.startsWith(`${parentPathKey}.`)) {
      const rest = p === parentPathKey ? '' : p.slice(parentPathKey.length + 1);
      const seg = rest.split('.')[0]?.trim();
      if (seg) set.add(seg);
    }
  }
  return set;
}

function randomEphemeralSegment(): string {
  const n =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${EPHEMERAL_SEGMENT_PREFIX}${n}`;
}

/**
 * Unique ephemeral segment under parent (never shown; user names the row in the label editor).
 */
export function uniqueSegmentUnderParent(entries: MappingEntry[], parentPathKey: string): string {
  const used = childSegmentsUnderParent(entries, parentPathKey);
  let seg = randomEphemeralSegment();
  let guard = 0;
  while (used.has(seg) && guard < 50) {
    seg = randomEphemeralSegment();
    guard += 1;
  }
  return seg;
}

function internalPathForSibling(entries: MappingEntry[], targetPathKey: string): string {
  const parent = parentPathKey(targetPathKey);
  const seg = uniqueSegmentUnderParent(entries, parent);
  return parent ? `${parent}.${seg}` : seg;
}

function internalPathForChild(entries: MappingEntry[], parentPathKey: string): string {
  const seg = uniqueSegmentUnderParent(entries, parentPathKey);
  return `${parentPathKey}.${seg}`;
}

/** Remove path prefixes from collapsed set so a new nested row is visible. */
export function expandAncestorsOfPath(collapsed: Set<string>, internalPath: string): Set<string> {
  const next = new Set(collapsed);
  const parts = internalPath
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let acc = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    acc = i === 0 ? parts[0] : `${acc}.${parts[i]}`;
    next.delete(acc);
  }
  return next;
}

function orderedSubtreeBounds(
  ordered: MappingEntry[],
  pathKey: string
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (let i = 0; i < ordered.length; i++) {
    const p = ordered[i].internalPath;
    if (p === pathKey || p.startsWith(`${pathKey}.`)) {
      if (start < 0) start = i;
      end = i;
    }
  }
  if (start < 0) return null;
  return { start, end };
}

function firstDescendantIndex(ordered: MappingEntry[], pathKey: string): number | null {
  const prefix = `${pathKey}.`;
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].internalPath.startsWith(prefix)) return i;
  }
  return null;
}

function computeInsertAtAndPath(
  entries: MappingEntry[],
  ordered: MappingEntry[],
  pos: ParamDropPosition
): { insertAt: number; internalPath: string } {
  const { targetPathKey, placement } = pos;
  const T = targetPathKey;

  if (T === '' && placement === 'after') {
    const internalPath = uniqueSegmentUnderParent(entries, '');
    return { insertAt: 0, internalPath };
  }

  if (placement === 'child') {
    const internalPath = internalPathForChild(entries, T);
    const fd = firstDescendantIndex(ordered, T);
    let insertAt: number;
    if (fd !== null) insertAt = fd;
    else {
      const self = ordered.findIndex((e) => e.internalPath === T);
      insertAt = self >= 0 ? self + 1 : ordered.length;
    }
    return { insertAt, internalPath };
  }

  const internalPath = internalPathForSibling(entries, T);
  const bounds = orderedSubtreeBounds(ordered, T);
  if (!bounds) {
    return { insertAt: ordered.length, internalPath };
  }
  if (placement === 'before') {
    return { insertAt: bounds.start, internalPath };
  }
  return { insertAt: bounds.end + 1, internalPath };
}

/**
 * Returns insertion index in **depth-first tree order** (see `entriesInDepthFirstOrder`) and the new internalPath.
 */
export function computeBackendParamInsert(
  entries: MappingEntry[],
  pos: ParamDropPosition,
  options?: ComputeBackendParamInsertOptions
): { insertAt: number; internalPath: string } {
  const siblingOrder = options?.siblingOrder ?? 'construction';
  const ordered = entriesInDepthFirstOrder(entries, siblingOrder);
  return computeInsertAtAndPath(entries, ordered, pos);
}

/**
 * Insert a new empty-ish mapping row; returns updated entries (reordered to depth-first order) and the new entry id.
 */
export function insertNewBackendParameter(
  entries: MappingEntry[],
  pos: ParamDropPosition,
  options?: ComputeBackendParamInsertOptions
): { next: MappingEntry[]; newEntry: MappingEntry } {
  const siblingOrder = options?.siblingOrder ?? 'construction';
  const ordered = entriesInDepthFirstOrder(entries, siblingOrder);
  const { insertAt, internalPath } = computeInsertAtAndPath(entries, ordered, pos);
  const newEntry = createMappingEntry({
    internalPath,
    apiField: '',
    linkedVariable: '',
    externalName: '',
  });
  const next = [...ordered.slice(0, insertAt), newEntry, ...ordered.slice(insertAt)];
  return { next, newEntry };
}
