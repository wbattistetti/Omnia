/**
 * Test normalize/query log runtime ConvAI V2.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('convaiRuntimeInvocationLog', () => {
  let tmpDir;
  let logFile;
  /** @type {typeof import('../index.js')} */
  let log;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-runtime-log-'));
    logFile = path.join(tmpDir, 'convai_runtime_invocations.json');
    process.env.OMNIA_CONVAI_RUNTIME_LOG_PATH = logFile;
    log = await import('../index.js');
  });

  afterEach(() => {
    delete process.env.OMNIA_CONVAI_RUNTIME_LOG_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appendConvaiRuntimeInvocation stores V2 dialog step record', () => {
    const record = log.appendConvaiRuntimeInvocation({
      kind: 'omnia_dialog_step',
      backendLabel: 'omnia_dialog_step',
      conversationId: 'conv-1',
      projectId: 'proj1',
      agentTaskId: 'agentA',
      gatewayPath: '/api/runtime/omnia-dialog-step/proj1/agentA',
      httpStatus: 200,
      dialogStatus: 'ask',
      requestBodyFromClient: { conversationId: 'conv-1', updates: {} },
      upstreamResponsePreview: { status: 'ask', say: 'Quale specialità?' },
      durationMs: 10,
      error: null,
    });
    expect(record?.schemaVersion).toBe(2);
    expect(record?.kind).toBe('omnia_dialog_step');
    expect(record?.dialogStatus).toBe('ask');
  });

  it('listConvaiRuntimeInvocations filters by conversationId', () => {
    log.appendConvaiRuntimeInvocation({
      kind: 'omnia_dialog_step',
      backendLabel: 'omnia_dialog_step',
      conversationId: 'conv-a',
      projectId: 'p',
      agentTaskId: 'a',
      httpStatus: 200,
      dialogStatus: 'ask',
      requestBodyFromClient: {},
      upstreamResponsePreview: { status: 'ask' },
      durationMs: 1,
      error: null,
    });
    log.appendConvaiRuntimeInvocation({
      kind: 'convai_webhook_gateway',
      backendLabel: 'book',
      conversationId: 'conv-b',
      projectId: 'p',
      agentTaskId: 'a',
      backendTaskId: 'bk1',
      httpStatus: 200,
      dialogStatus: null,
      requestBodyFromClient: {},
      upstreamResponsePreview: '{"ok":true}',
      durationMs: 2,
      error: null,
    });

    expect(log.listConvaiRuntimeInvocations({ conversationId: 'conv-a' })).toHaveLength(1);
    expect(log.listConvaiRuntimeInvocations({ kind: 'convai_webhook_gateway' })).toHaveLength(1);
  });

  it('allows null conversationId with missing_conversation_id error', () => {
    const record = log.appendConvaiRuntimeInvocation({
      kind: 'omnia_dialog_step',
      backendLabel: 'omnia_dialog_step',
      conversationId: null,
      projectId: 'p',
      agentTaskId: 'a',
      httpStatus: 400,
      dialogStatus: 'error',
      requestBodyFromClient: {},
      upstreamResponsePreview: { status: 'error', error: 'missing_conversation_id' },
      durationMs: 1,
      error: 'missing_conversation_id',
    });
    expect(record?.conversationId).toBeNull();
  });
});
