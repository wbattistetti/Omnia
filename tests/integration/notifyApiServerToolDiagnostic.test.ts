/**
 * Express → ApiServer: il modulo di notifica invia POST con secret e payload atteso (senza ApiServer .NET reale).
 */
import http from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('notifyApiServerBookFromAgendaFailure', () => {
  let prevSecret: string | undefined;
  let prevBase: string | undefined;

  beforeEach(() => {
    prevSecret = process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET;
    prevBase = process.env.OMNIA_API_SERVER_URL;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevSecret !== undefined) process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET = prevSecret;
    else delete process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET;
    if (prevBase !== undefined) process.env.OMNIA_API_SERVER_URL = prevBase;
    else delete process.env.OMNIA_API_SERVER_URL;
    vi.resetModules();
  });

  it('skips when OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET is unset', async () => {
    delete process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET;
    delete process.env.OMNIA_API_SERVER_URL;
    const { notifyApiServerBookFromAgendaFailure } = await import(
      '../../backend/services/notifyApiServerToolDiagnostic.js'
    );
    const r = await notifyApiServerBookFromAgendaFailure({
      conversationId: 'omnia_conv_x',
      httpStatus: 400,
      payload: { ok: false, error: 'bad', diagnostic: { schemaVersion: 1 } },
    });
    expect(r.skipped).toBe(true);
  });

  it('POSTs JSON to /elevenlabs/internal/enqueueToolDiagnostic with secret header', async () => {
    let captured: { method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string } | null =
      null;

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        captured = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end('{"ok":true}');
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('expected tcp address');
    const port = addr.port;

    process.env.OMNIA_INTERNAL_TOOL_DIAGNOSTIC_SECRET = 'unit-test-secret-xyz';
    process.env.OMNIA_API_SERVER_URL = `http://127.0.0.1:${port}`;

    const { notifyApiServerBookFromAgendaFailure } = await import(
      '../../backend/services/notifyApiServerToolDiagnostic.js'
    );

    const diagnostic = {
      schemaVersion: 1,
      timeline: [{ id: 'query_constraints_shape', ok: false }],
    };
    const r = await notifyApiServerBookFromAgendaFailure({
      conversationId: 'omnia_conv_abcd',
      httpStatus: 400,
      payload: {
        ok: false,
        error: 'bookfromagenda: queryConstraints must be a JSON object',
        diagnostic,
      },
    });

    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));

    expect(r.ok).toBe(true);
    expect(captured).not.toBeNull();
    expect(captured!.method).toBe('POST');
    expect(captured!.url).toContain('/elevenlabs/internal/enqueueToolDiagnostic');
    expect(String(captured!.headers['x-omnia-internal-tool-secret'])).toBe('unit-test-secret-xyz');

    const parsed = JSON.parse(captured!.body) as Record<string, unknown>;
    expect(parsed.conversationId).toBe('omnia_conv_abcd');
    expect(parsed.httpStatus).toBe(400);
    expect(parsed.diagnostic).toEqual(diagnostic);
  });
});
