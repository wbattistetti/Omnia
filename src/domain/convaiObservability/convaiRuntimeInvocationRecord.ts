/**
 * Schema V2 — record log runtime ConvAI → Express.
 */

export const CONVAI_RUNTIME_INVOCATION_SCHEMA_VERSION = 2 as const;

export type ConvaiRuntimeInvocationKind = 'omnia_dialog_step' | 'convai_webhook_gateway';

export type ConvaiDialogStatus = 'ask' | 'invalid' | 'complete' | 'error';

export type ConvaiRuntimeInvocationRecord = {
  schemaVersion: typeof CONVAI_RUNTIME_INVOCATION_SCHEMA_VERSION;
  id: string;
  ts: string;
  kind: ConvaiRuntimeInvocationKind;
  backendLabel: string;
  conversationId: string | null;
  projectId: string | null;
  agentTaskId: string | null;
  backendTaskId: string | null;
  gatewayPath: string | null;
  upstreamUrl: string | null;
  forwardMethod: string | null;
  httpStatus: number;
  dialogStatus: ConvaiDialogStatus | null;
  requestBodyFromClient: string | null;
  requestBodyAfterSendHints: string | null;
  upstreamResponsePreview: string | null;
  upstreamHttpStatus: number | null;
  durationMs: number;
  sendHintsApplied: number | null;
  error: string | null;
};

export function isConvaiRuntimeInvocationRecord(row: unknown): row is ConvaiRuntimeInvocationRecord {
  if (!row || typeof row !== 'object') return false;
  const r = row as ConvaiRuntimeInvocationRecord;
  return r.schemaVersion === CONVAI_RUNTIME_INVOCATION_SCHEMA_VERSION && typeof r.kind === 'string';
}
