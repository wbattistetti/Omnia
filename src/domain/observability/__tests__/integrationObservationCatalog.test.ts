import { describe, expect, it } from 'vitest';
import {
  resolveIntegrationObservation,
  resolveIntegrationObservationForConvaiWebhook,
  INTEGRATION_OBSERVATION_REGISTRY,
} from '../integrationObservationCatalog';

describe('resolveIntegrationObservation', () => {
  it('maps BookFromAgenda envelope code to query_constraints_wrong_type', () => {
    const preview = JSON.stringify({
      ok: false,
      error: 'bookfromagenda: queryConstraints must be…',
      code: 'bookfromagenda_query_constraints_type',
      hint: 'Invia queryConstraints come oggetto JSON…',
      diagnostic: { summary: { failedStepId: 'query_constraints_shape' } },
    });
    const r = resolveIntegrationObservation({
      taskId: 't1',
      endpoint: 'http://localhost:3100/api/runtime/bookfromagenda',
      outcome: 'http_error',
      httpStatus: 400,
      errorMessage: 'bookfromagenda: …',
      responsePreview: preview,
    });
    expect(r?.event).toBe('query_constraints_wrong_type');
    expect(r?.hintUi).toContain('oggetto JSON');
    expect(r?.fields.backendCode).toBe('bookfromagenda_query_constraints_type');
  });

  it('returns validation_rejected for body_not_object code', () => {
    const preview = JSON.stringify({
      code: 'bookfromagenda_body_not_object',
      error: 'body must be a JSON object',
    });
    const r = resolveIntegrationObservation({
      taskId: 't1',
      endpoint: 'http://x/api/runtime/bookfromagenda',
      outcome: 'http_error',
      httpStatus: 400,
      errorMessage: 'fail',
      responsePreview: preview,
    });
    expect(r?.event).toBe('validation_rejected');
  });

  it('maps HTTP 403 to webhook_auth_failed', () => {
    const r = resolveIntegrationObservation({
      taskId: 't1',
      endpoint: 'https://api/x',
      outcome: 'http_error',
      httpStatus: 403,
      errorMessage: 'Forbidden',
      responsePreview: null,
    });
    expect(r?.event).toBe('webhook_auth_failed');
  });

  it('returns null for successful bookfromagenda call', () => {
    const r = resolveIntegrationObservation({
      taskId: 't1',
      endpoint: 'http://localhost:3100/api/runtime/bookfromagenda',
      outcome: 'http_success',
      httpStatus: 200,
      errorMessage: null,
      responsePreview: JSON.stringify({ slots: [] }),
    });
    expect(r).toBeNull();
  });

  it('registry has entries for all exported resolver events used', () => {
    expect(INTEGRATION_OBSERVATION_REGISTRY.query_constraints_wrong_type?.titleUi).toBeTruthy();
    expect(INTEGRATION_OBSERVATION_REGISTRY.validation_rejected?.titleUi).toBeTruthy();
    expect(INTEGRATION_OBSERVATION_REGISTRY.tunnel_not_running?.titleUi).toBeTruthy();
  });

  it('respects explicit catalogEvent from orchestrator over inference', () => {
    const r = resolveIntegrationObservation({
      taskId: 't1',
      endpoint: 'http://x/y',
      outcome: 'http_success',
      httpStatus: 200,
      errorMessage: null,
      responsePreview: null,
      catalogEvent: 'session_not_found',
      catalogHint: 'Alias non registrato dopo restart.',
      catalogFields: { conversationId: 'omnia_conv_x' },
    });
    expect(r?.event).toBe('session_not_found');
    expect(r?.hintUi).toContain('Alias non registrato');
    expect(r?.fields.conversationId).toBe('omnia_conv_x');
  });

  it('resolveIntegrationObservationForConvaiWebhook maps unreachable to tunnel_not_running', () => {
    const r = resolveIntegrationObservationForConvaiWebhook({
      toolName: 'book_agenda',
      endpoint: 'http://localhost:3100/api/runtime/bookfromagenda',
      unreachable: true,
      errorMessage: 'Tunnel richiesto per localhost',
    });
    expect(r?.event).toBe('tunnel_not_running');
    expect(r?.fields.toolName).toBe('book_agenda');
  });

  it('resolveIntegrationObservationForConvaiWebhook uses dev_tunnel_misconfigured when message suggests mapping error', () => {
    const r = resolveIntegrationObservationForConvaiWebhook({
      toolName: 't',
      endpoint: 'http://localhost/p',
      unreachable: true,
      errorMessage: 'Wrong port — tunnel mapping misconfigured',
    });
    expect(r?.event).toBe('dev_tunnel_misconfigured');
  });

  it('returns null for reachable ConvAI webhook', () => {
    expect(
      resolveIntegrationObservationForConvaiWebhook({
        toolName: 't',
        endpoint: 'https://pub.ngrok.io/x',
        unreachable: false,
      })
    ).toBeNull();
  });
});
