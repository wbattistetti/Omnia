/**
 * Insert a new backend mapping row at a tree drop position (flat entries array order).
 */

import type { MappingEntry } from './mappingTypes';
import { createMappingEntry } from './mappingTypes';
import { parentPathKey } from './mappingTreeUtils';

/** MIME type for dragging "new parameter" from SEND/RECEIVE headers. */
export const DND_NEW_BACKEND_PARAM = 'application/x-omnia-new-backend-param';

/** Internal path segment for rows not yet named (hidden in UI; user types real name). */
export const EPHEMERAL_SEGMENT_PREFIX = '__omnia_n_';

export type ParamDropPlacement = 'before' | 'after' | 'child';

export interface ParamDropPosition {
  targetPathKey: string;
  placement: ParamDropPlacement;
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

/**
 * Returns insertion index in entries and the new internalPath.
 */
export function computeBackendParamInsert(
  entries: MappingEntry[],
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
    const childIdx = entries
      .map((e, i) => i)
      .filter((i) => entries[i].internalPath.startsWith(`${T}.`));
    const selfIdx = entries.findIndex((e) => e.internalPath === T);
    let insertAt: number;
    if (childIdx.length > 0) insertAt = Math.min(...childIdx);
    else if (selfIdx >= 0) insertAt = selfIdx + 1;
    else insertAt = entries.length;
    return { insertAt, internalPath };
  }

  const indices = subtreeEntryIndices(entries, T);
  const internalPath = internalPathForSibling(entries, T);

  if (placement === 'before') {
    const insertAt = indices.length > 0 ? Math.min(...indices) : entries.length;
    return { insertAt, internalPath };
  }

  const insertAt = indices.length > 0 ? Math.max(...indices) + 1 : entries.length;
  return { insertAt, internalPath };
}

/**
 * Insert a new empty-ish mapping row; returns updated entries and the new entry id.
 */
export function insertNewBackendParameter(
  entries: MappingEntry[],
  pos: ParamDropPosition
): { next: MappingEntry[]; newEntry: MappingEntry } {
  const { insertAt, internalPath } = computeBackendParamInsert(entries, pos);
  const newEntry = createMappingEntry({
    internalPath,
    apiField: '',
    linkedVariable: '',
    externalName: '',
  });
  const next = [...entries.slice(0, insertAt), newEntry, ...entries.slice(insertAt)];
  return { next, newEntry };
}
