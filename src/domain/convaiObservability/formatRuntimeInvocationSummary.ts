/**
 * Riga sintetica per accordion log runtime ConvAI.
 */

import type { ConvaiRuntimeInvocationRecord } from './convaiRuntimeInvocationRecord';

export function formatRuntimeInvocationSummary(record: ConvaiRuntimeInvocationRecord): string {
  const kind =
    record.kind === 'omnia_dialog_step' ? 'omnia_dialog_step' : record.backendLabel || 'gateway';
  const status =
    record.kind === 'omnia_dialog_step' && record.dialogStatus
      ? record.dialogStatus
      : record.error
        ? record.error
        : `HTTP ${record.httpStatus}`;
  return `${kind} · ${status} · ${record.durationMs} ms`;
}
