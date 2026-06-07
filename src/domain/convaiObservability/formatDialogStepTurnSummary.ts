/**
 * Riga compatta slot-filling omnia_dialog_step per bubble Test agente.
 */

import type { ConvaiRuntimeInvocationRecord } from './convaiRuntimeInvocationRecord';

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function formatUpdates(updates: unknown): string {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return '{}';
  const keys = Object.keys(updates as Record<string, unknown>);
  if (keys.length === 0) return '{}';
  try {
    return JSON.stringify(updates);
  } catch {
    return '{…}';
  }
}

/** Sintesi per turno: body ElevenLabs → stato Omnia. */
export function formatDialogStepTurnSummary(record: ConvaiRuntimeInvocationRecord): string {
  const req = parseJsonObject(record.requestBodyFromClient);
  const resp = parseJsonObject(record.upstreamResponsePreview);
  const conversationId = String(req?.conversationId ?? record.conversationId ?? '—').trim() || '—';
  const updates = formatUpdates(req?.updates ?? req?.slots);
  const status = String(resp?.status ?? record.dialogStatus ?? '—');
  const next = String(resp?.nextColumnId ?? '—').trim() || '—';
  const convPreview =
    conversationId.length > 24 ? `${conversationId.slice(0, 22)}…` : conversationId;
  return `conv=${convPreview} · EL updates=${updates} → Omnia ${status}${next !== '—' ? ` · next=${next}` : ''}`;
}

/** Prima invocazione omnia_dialog_step nel batch turno, se presente. */
export function pickDialogStepTurnSummary(
  invocations: readonly ConvaiRuntimeInvocationRecord[] | undefined
): string | null {
  if (!invocations?.length) return null;
  const rec = invocations.find((r) => r.kind === 'omnia_dialog_step');
  if (!rec) return null;
  return formatDialogStepTurnSummary(rec);
}
