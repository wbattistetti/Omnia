/**
 * Read-only revision mirror: groups consecutive code units with the same visual class
 * so green/red highlights are contiguous blocks (not one box per character).
 */

import React from 'react';
import type { RevisionCharMeta } from './textRevisionLinear';

type RevisionMirrorClass = 'omnia-text-rev-base' | 'omnia-text-rev-insert' | 'omnia-text-rev-delete';

function mirrorClassForIndex(
  meta: readonly RevisionCharMeta[],
  deletedMask: readonly boolean[],
  i: number
): RevisionMirrorClass {
  const m = meta[i];
  if (!m) {
    return 'omnia-text-rev-base';
  }
  if (m.kind === 'insert') {
    return 'omnia-text-rev-insert';
  }
  const struck = m.baseIndex < deletedMask.length && deletedMask[m.baseIndex];
  return struck ? 'omnia-text-rev-delete' : 'omnia-text-rev-base';
}

/**
 * Builds minimal consecutive spans for the styled mirror under the transparent textarea.
 */
export function buildRevisionMirrorNodes(
  linear: string,
  meta: readonly RevisionCharMeta[],
  deletedMask: readonly boolean[]
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < linear.length) {
    const cls = mirrorClassForIndex(meta, deletedMask, i);
    let j = i + 1;
    while (j < linear.length && mirrorClassForIndex(meta, deletedMask, j) === cls) {
      j++;
    }
    const key = `${i}-${cls}-${j}`;
    out.push(
      <span key={key} className={cls}>
        {linear.slice(i, j)}
      </span>
    );
    i = j;
  }
  return out;
}
