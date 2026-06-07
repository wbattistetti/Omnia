/**
 * Accordion log runtime ConvAI V2 sotto bolla bot (debugger).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlowConvaiRuntimeInvocationsPanel } from '../FlowConvaiRuntimeInvocationsPanel';
import type { ConvaiRuntimeInvocationRecord } from '@domain/convaiObservability/convaiRuntimeInvocationRecord';

function sampleRecord(
  overrides: Partial<ConvaiRuntimeInvocationRecord> = {}
): ConvaiRuntimeInvocationRecord {
  return {
    schemaVersion: 2,
    id: 'rec-1',
    ts: '2026-06-05T10:00:00.000Z',
    kind: 'omnia_dialog_step',
    backendLabel: 'Dialog step',
    conversationId: 'conv-abc',
    projectId: 'proj-1',
    agentTaskId: 'agent-1',
    backendTaskId: null,
    gatewayPath: '/api/runtime/convai/omnia-dialog-step',
    upstreamUrl: null,
    forwardMethod: null,
    httpStatus: 200,
    dialogStatus: 'ask',
    requestBodyFromClient: '{"user_text":"ciao"}',
    requestBodyAfterSendHints: null,
    upstreamResponsePreview: '{"say":"Ciao!"}',
    upstreamHttpStatus: null,
    durationMs: 42,
    sendHintsApplied: null,
    error: null,
    ...overrides,
  };
}

describe('FlowConvaiRuntimeInvocationsPanel', () => {
  it('renders accordion header with invocation count', () => {
    render(
      <FlowConvaiRuntimeInvocationsPanel invocations={[sampleRecord(), sampleRecord({ id: 'rec-2' })]} />
    );
    expect(screen.getByText('Log ConvAI/Omnia (2)')).toBeInTheDocument();
  });

  it('returns null when invocations list is empty', () => {
    const { container } = render(<FlowConvaiRuntimeInvocationsPanel invocations={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
