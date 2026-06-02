/**
 * ConvAI webhook invocation log service — append, filter, rolling cap.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('convaiWebhookInvocationLogService', () => {
  let tmpDir;
  let logFile;
  /** @type {typeof import('../convaiWebhookInvocationLogService.js')} */
  let service;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-convai-log-'));
    logFile = path.join(tmpDir, 'convai_webhook_invocations.json');
    process.env.OMNIA_CONVAI_WEBHOOK_LOG_PATH = logFile;
    service = await import('../convaiWebhookInvocationLogService.js');
  });

  afterEach(() => {
    delete process.env.OMNIA_CONVAI_WEBHOOK_LOG_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appendInvocation stores and filters by agentTaskId', () => {
    service.appendInvocation({
      projectId: 'proj1',
      agentTaskId: 'agentA',
      backendTaskId: 'bk1',
      backendLabel: 'slots',
      gatewayPath: '/api/runtime/convai-webhook/proj1/agentA/bk1',
      upstreamUrl: 'http://localhost:3110/slots',
      forwardMethod: 'POST',
      requestBodyFromClient: { q: 1 },
      requestBodyAfterSendHints: { q: 1 },
      upstreamStatus: 200,
      upstreamResponsePreview: '{"ok":true}',
      durationMs: 42,
      sendHintsApplied: 0,
    });
    service.appendInvocation({
      projectId: 'proj1',
      agentTaskId: 'agentB',
      backendTaskId: 'bk2',
      upstreamUrl: 'http://localhost:3110/other',
      durationMs: 10,
    });

    const forAgentA = service.listInvocations({ agentTaskId: 'agentA' });
    expect(forAgentA).toHaveLength(1);
    expect(forAgentA[0].backendLabel).toBe('slots');
    expect(forAgentA[0].upstreamStatus).toBe(200);
  });

  it('clearInvocations empties the log', () => {
    service.appendInvocation({
      projectId: 'p',
      agentTaskId: 'a',
      backendTaskId: 'b',
      durationMs: 1,
    });
    expect(service.listInvocations()).toHaveLength(1);
    service.clearInvocations();
    expect(service.listInvocations()).toHaveLength(0);
  });
});
