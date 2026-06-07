import { describe, expect, it } from 'vitest';
import {
  buildConvaiWebhookGatewayUrl,
  buildOmniaDialogStepUrl,
  convaiWebhookGatewayPath,
  isConvaiWebhookGatewayUrl,
  OMNIA_RUNTIME_DEFAULT_ORIGIN,
  resolveOmniaDialogStepRuntimeOrigin,
  resolveOmniaRuntimeOrigin,
} from '../convaiWebhookGatewayUrl';

describe('convaiWebhookGatewayUrl', () => {
  it('builds path with encoded segments', () => {
    expect(convaiWebhookGatewayPath('proj/a', 'agent b', 'bk-1')).toBe(
      '/api/runtime/convai-webhook/proj%2Fa/agent%20b/bk-1'
    );
  });

  it('builds absolute gateway URL on Omnia runtime origin', () => {
    const url = buildConvaiWebhookGatewayUrl({
      origin: OMNIA_RUNTIME_DEFAULT_ORIGIN,
      projectId: 'p1',
      agentTaskId: 'a1',
      backendTaskId: 'b1',
    });
    expect(url).toBe(
      'http://localhost:3100/api/runtime/convai-webhook/p1/a1/b1'
    );
  });

  it('detects gateway URLs', () => {
    expect(isConvaiWebhookGatewayUrl('http://localhost:3100/api/runtime/convai-webhook/p/a/b')).toBe(
      true
    );
    expect(isConvaiWebhookGatewayUrl('https://api.example.com/slots')).toBe(false);
  });

  it('resolveOmniaRuntimeOrigin prefers explicit base', () => {
    expect(resolveOmniaRuntimeOrigin('https://pub.example/')).toBe('https://pub.example');
    expect(resolveOmniaRuntimeOrigin()).toBe(OMNIA_RUNTIME_DEFAULT_ORIGIN);
  });

  it('resolveOmniaDialogStepRuntimeOrigin defaults to Express gateway (3100)', () => {
    expect(resolveOmniaDialogStepRuntimeOrigin()).toBe(OMNIA_RUNTIME_DEFAULT_ORIGIN);
    expect(resolveOmniaDialogStepRuntimeOrigin('https://pub.ngrok.app/')).toBe(
      'https://pub.ngrok.app'
    );
  });

  it('buildOmniaDialogStepUrl uses Express origin by default', () => {
    expect(
      buildOmniaDialogStepUrl({
        origin: resolveOmniaDialogStepRuntimeOrigin(),
        projectId: 'p1',
        agentTaskId: 'a1',
      })
    ).toBe('http://localhost:3100/api/runtime/omnia-dialog-step/p1/a1');
  });
});
