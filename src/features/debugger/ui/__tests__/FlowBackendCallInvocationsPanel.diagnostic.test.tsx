/**
 * Debugger: card diagnostica ConvAI / BookFromAgenda con errore HTTP (payload SSE simulato).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlowBackendCallInvocationsPanel } from '../FlowBackendCallInvocationsPanel';
import type { FlowBackendCallInvocation } from '@features/debugger/types/flowBackendCallDiagnostic';

describe('FlowBackendCallInvocationsPanel (BookFromAgenda / http 400)', () => {
  it('shows http error badge and HTTP status for ConvAI tool diagnostic', () => {
    const invocations: FlowBackendCallInvocation[] = [
      {
        taskId: 'task-guid-here',
        displayName: 'BookFromAgenda',
        endpoint: 'POST /api/runtime/bookfromagenda',
        method: 'POST',
        outcome: 'http_error',
        errorMessage:
          'bookfromagenda: queryConstraints must be a JSON object (not a string). Example: { "weekdays": [2, 4], "horizon": { "start": "2026-05-01", "end": "2026-05-31" } }.',
        inputParameters: [{ name: 'conversationId', value: 'omnia_conv_test' }],
        outputParameters: [],
        httpStatus: 400,
        responsePreview: JSON.stringify({
          ok: false,
          error: 'bookfromagenda: queryConstraints must be a JSON object',
          diagnostic: { schemaVersion: 1, timeline: [{ id: 'query_constraints_shape', ok: false }] },
        }),
        diagnostic: { schemaVersion: 1 },
      },
    ];

    render(<FlowBackendCallInvocationsPanel invocations={invocations} />);

    expect(screen.getByText('tool ConvAI')).toBeInTheDocument();
    expect(screen.getByText('http err')).toBeInTheDocument();
    expect(screen.getByText('HTTP 400')).toBeInTheDocument();
    expect(screen.getAllByText(/queryConstraints must be a JSON object/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('queryConstraints non valido')).toBeInTheDocument();
    expect(screen.getByText('query_constraints_wrong_type')).toBeInTheDocument();
  });
});
