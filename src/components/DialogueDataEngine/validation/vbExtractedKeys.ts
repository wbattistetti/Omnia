/**
 * Validates VB contract-extract response keys against the current main node's subs.
 * Any key outside subs (except optional leaf `value`) is a contract↔DDT alignment error.
 */

import type { DDTNode } from '../model/ddt.v2.types';

export class VbSubIdMismatchError extends Error {
  constructor(
    message: string,
    public readonly keys: string[],
    public readonly allowedSubs: string[]
  ) {
    super(message);
    this.name = 'VbSubIdMismatchError';
  }
}

/**
 * Throws if `extracted` contains keys not present in `main.subs` (composite mains).
 * Leaf mains without subs: allows any shape; if only `value` is used, no check.
 */
export function assertVbKeysMatchSubs(extracted: Record<string, unknown>, main: DDTNode): void {
  const subs = main.subs;
  if (!subs || subs.length === 0) return;
  const allowed = new Set(subs);
  for (const k of Object.keys(extracted)) {
    if (k === 'value') continue;
    if (!allowed.has(k)) {
      throw new VbSubIdMismatchError(
        `VB extraction keys [${Object.keys(extracted).join(', ')}] are not aligned with main subs [${subs.join(', ')}]: unexpected key "${k}"`,
        Object.keys(extracted),
        [...subs]
      );
    }
  }
}
