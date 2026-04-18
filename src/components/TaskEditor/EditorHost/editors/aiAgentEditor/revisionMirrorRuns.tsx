/**
 * Read-only revision mirror: groups consecutive code units with the same visual class
 * so green/red highlights are contiguous blocks (not one box per character).
 */

import React from 'react';
import type { RevisionCharMeta } from './textRevisionLinear';

type RevisionMirrorClass = 'omnia-text-rev-base' | 'omnia-text-rev-insert' | 'omnia-text-rev-delete';

/** Full inline display `🗄️ path` (aligned with compile expansion). */
const BACKEND_DISPLAY_FULL_RE = /🗄️\s+[A-Za-z0-9_.]+/gu;

function splitBackendDisplayFragments(text: string): Array<{ kind: 'plain' | 'backend'; text: string }> {
  const out: Array<{ kind: 'plain' | 'backend'; text: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(BACKEND_DISPLAY_FULL_RE.source, 'gu');
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: 'plain', text: text.slice(last, m.index) });
    }
    out.push({ kind: 'backend', text: m[0] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    out.push({ kind: 'plain', text: text.slice(last) });
  }
  if (out.length === 0 && text.length > 0) {
    out.push({ kind: 'plain', text });
  }
  return out;
}

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
    const sliceText = linear.slice(i, j);
    const fragments = splitBackendDisplayFragments(sliceText);
    out.push(
      <span key={key} className={cls}>
        {fragments.map((frag, fi) =>
          frag.kind === 'backend' ? (
            <span key={`${key}-fr-${fi}`} className="omnia-backend-token-badge">
              {frag.text}
            </span>
          ) : (
            <React.Fragment key={`${key}-fr-${fi}`}>{frag.text}</React.Fragment>
          )
        )}
      </span>
    );
    i = j;
  }
  return out;
}
