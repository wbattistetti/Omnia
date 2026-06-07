/**
 * REST API log runtime ConvAI (schema V2 only).
 *   GET    /api/convai-runtime-invocations
 *   DELETE /api/convai-runtime-invocations
 */

'use strict';

const { SCHEMA_VERSION } = require('./types');
const {
  listConvaiRuntimeInvocations,
  clearConvaiRuntimeInvocations,
} = require('./query');

function mountConvaiRuntimeInvocationRoutes(app) {
  app.get('/api/convai-runtime-invocations', (req, res) => {
    try {
      const limit = Number(req.query.limit);
      const items = listConvaiRuntimeInvocations({
        limit,
        conversationId:
          typeof req.query.conversationId === 'string' ? req.query.conversationId : undefined,
        kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        agentTaskId: typeof req.query.agentTaskId === 'string' ? req.query.agentTaskId : undefined,
        backendTaskId:
          typeof req.query.backendTaskId === 'string' ? req.query.backendTaskId : undefined,
        since: typeof req.query.since === 'string' ? req.query.since : undefined,
        until: typeof req.query.until === 'string' ? req.query.until : undefined,
      });
      res.json({ ok: true, schemaVersion: SCHEMA_VERSION, count: items.length, items });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.delete('/api/convai-runtime-invocations', (_req, res) => {
    try {
      clearConvaiRuntimeInvocations();
      res.json({ ok: true, schemaVersion: SCHEMA_VERSION });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });
}

module.exports = { mountConvaiRuntimeInvocationRoutes };
