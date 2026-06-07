import { describe, expect, it } from 'vitest';
import {
  formatDialogStepTurnSummary,
  pickDialogStepTurnSummary,
} from '../formatDialogStepTurnSummary';
import type { ConvaiRuntimeInvocationRecord } from '../convaiRuntimeInvocationRecord';

function sampleRecord(
  overrides: Partial<ConvaiRuntimeInvocationRecord> = {}
): ConvaiRuntimeInvocationRecord {
  return {
    schemaVersion: 2,
    id: 'rec-1',
    ts: '2026-06-06T10:00:00.000Z',
    kind: 'omnia_dialog_step',
    backendLabel: 'omnia_dialog_step',
    conversationId: 'omnia_conv_abc',
    projectId: 'proj-1',
    agentTaskId: 'agent-1',
    backendTaskId: null,
    gatewayPath: '/api/runtime/omnia-dialog-step/proj-1/agent-1',
    upstreamUrl: null,
    forwardMethod: null,
    httpStatus: 200,
    dialogStatus: 'ask',
    requestBodyFromClient:
      '{"conversationId":"omnia_conv_abc","updates":{"specialita":"Cardiologia"}}',
    requestBodyAfterSendHints: null,
    upstreamResponsePreview:
      '{"status":"ask","nextColumnId":"tipo_visita","binding":{"specialita":"Cardiologia"}}',
    upstreamHttpStatus: null,
    durationMs: 40,
    sendHintsApplied: null,
    error: null,
    ...overrides,
  };
}

describe('formatDialogStepTurnSummary', () => {
  it('formats updates and next column from request/response', () => {
    const line = formatDialogStepTurnSummary(sampleRecord());
    expect(line).toContain('EL updates={"specialita":"Cardiologia"}');
    expect(line).toContain('Omnia ask');
    expect(line).toContain('next=tipo_visita');
    expect(line).toContain('conv=omnia_conv_abc');
  });

  it('shows empty updates when absent', () => {
    const line = formatDialogStepTurnSummary(
      sampleRecord({
        requestBodyFromClient: '{"conversationId":"omnia_conversation_id"}',
        upstreamResponsePreview: '{"status":"ask","nextColumnId":"specialita"}',
      })
    );
    expect(line).toContain('EL updates={}');
    expect(line).toContain('next=specialita');
  });

  it('pickDialogStepTurnSummary returns first dialog step record', () => {
    const gateway: ConvaiRuntimeInvocationRecord = {
      ...sampleRecord(),
      id: 'gw-1',
      kind: 'convai_webhook_gateway',
      backendLabel: 'BookFromAgenda',
    };
    const summary = pickDialogStepTurnSummary([gateway, sampleRecord()]);
    expect(summary).toContain('specialita');
  });
});
