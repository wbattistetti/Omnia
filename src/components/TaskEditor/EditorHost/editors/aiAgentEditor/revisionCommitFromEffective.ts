/**
 * Commits a full effective-text edit from Monaco (or plain editor) into the section revision slice.
 */

import { buildLinearDocument } from './textRevisionLinear';
import { linearEditToBatchOps, type RevisionBatchOp } from './textRevisionLinear';
import type { InsertOp } from './effectiveFromRevisionMask';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import { diffToOps } from './otDiffToOps';
import type { OtOp } from './otTypes';

export type CommitEffectiveTextParams = {
  baseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  otMode: boolean;
  otCurrentText: string | undefined;
  targetEffective: string;
};

export type CommitEffectiveTextResult =
  | { kind: 'noop' }
  | { kind: 'ot'; ops: OtOp[] }
  | { kind: 'linear'; ops: RevisionBatchOp[] };

/**
 * Maps edited body text to OT ops or linear batch ops (no-op if unchanged).
 */
export function commitEffectiveTextChange(params: CommitEffectiveTextParams): CommitEffectiveTextResult {
  const { baseText, deletedMask, inserts, otMode, otCurrentText, targetEffective } = params;
  const currentEffective =
    otMode && otCurrentText !== undefined
      ? otCurrentText
      : effectiveFromRevisionMask(baseText, deletedMask, inserts);

  if (targetEffective === currentEffective) {
    return { kind: 'noop' };
  }

  if (otMode) {
    return { kind: 'ot', ops: diffToOps(baseText, targetEffective) };
  }

  const doc = buildLinearDocument(baseText, deletedMask, inserts);
  const ops = linearEditToBatchOps(
    doc.linear,
    targetEffective,
    doc.meta,
    baseText,
    deletedMask,
    inserts
  );
  return { kind: 'linear', ops };
}
