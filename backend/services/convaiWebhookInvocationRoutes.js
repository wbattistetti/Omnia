/**
 * REST routes for ConvAI webhook invocation guardalog (Task Editor panel).
 *   GET    /api/convai-webhook-invocations
 *   DELETE /api/convai-webhook-invocations
 */

const log = require('./convaiWebhookInvocationLogService');

function mountConvaiWebhookInvocationRoutes(app) {
  app.get('/api/convai-webhook-invocations', (req, res) => {
    try {
      const limit = Number(req.query.limit);
      const items = log.listInvocations({
        limit,
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        agentTaskId: typeof req.query.agentTaskId === 'string' ? req.query.agentTaskId : undefined,
        backendTaskId:
          typeof req.query.backendTaskId === 'string' ? req.query.backendTaskId : undefined,
      });
      res.json({ ok: true, count: items.length, items });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.delete('/api/convai-webhook-invocations', (_req, res) => {
    try {
      log.clearInvocations();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });
}

module.exports = { mountConvaiWebhookInvocationRoutes };
