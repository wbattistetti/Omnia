/**
 * Carte catalogo su diagnostica webhook ConvAI (tunnel non raggiungibile).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlowConvaiWebhookInvocationsPanel } from '../FlowConvaiWebhookInvocationsPanel';
import type { FlowConvaiWebhookDiagnostic } from '@features/debugger/types/flowConvaiWebhookDiagnostic';

describe('FlowConvaiWebhookInvocationsPanel (catalog)', () => {
  it('shows integration observation card when webhook URL is unreachable', () => {
    const invocations: FlowConvaiWebhookDiagnostic[] = [
      {
        kind: 'convai_webhook',
        toolName: 'book_agenda',
        endpoint: 'http://localhost:3100/api/runtime/bookfromagenda',
        method: 'POST',
        headers: {},
        inputSchemaSummary: {},
        unreachable: true,
        errorMessage: 'Avvia ngrok verso la porta 3100',
      },
    ];
    render(<FlowConvaiWebhookInvocationsPanel invocations={invocations} />);
    expect(screen.getByText('Tunnel pubblico assente o non attivo')).toBeInTheDocument();
    expect(screen.getByText('tunnel_not_running')).toBeInTheDocument();
  });
});
