/**
 * Express routes for the AI cost subsystem:
 *   - GET  /api/ai-calls                  : list of last N AI calls (newest first)
 *   - DELETE /api/ai-calls                : clear the call log (debug / reset)
 *   - GET  /api/ai-calls/pricing          : current pricing snapshot (read-only)
 *   - POST /api/ai-calls/pricing/refresh  : force a refetch from OpenRouter
 *   - GET  /api/ai-calls/exchange-rate    : current USD->EUR rate (refreshed on demand)
 *   - POST /api/ai-calls/exchange-rate/refresh : force a refetch from frankfurter.dev
 */

const log = require('./AICallLogService');
const pricing = require('./pricingSync');
const fx = require('./exchangeRateSync');

function mountAiCostRoutes(app) {
  app.get('/api/ai-calls', (req, res) => {
    try {
      const limit = Number(req.query.limit);
      const items = log.listCalls({ limit });
      res.json({ ok: true, count: items.length, items });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.delete('/api/ai-calls', (_req, res) => {
    try {
      log.clearCalls();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.get('/api/ai-calls/pricing', (_req, res) => {
    try {
      const cache = pricing.readCache();
      res.json({
        ok: true,
        count: cache.items.length,
        meta: cache.meta,
        items: cache.items,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ai-calls/pricing/refresh', async (_req, res) => {
    try {
      const result = await pricing.syncPricingFromOpenRouter();
      res.json({ ok: true, count: result.items.length, meta: result.meta });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.get('/api/ai-calls/exchange-rate', async (_req, res) => {
    try {
      const usdToEur = await fx.getUsdToEur();
      const cached = fx.readCache();
      res.json({
        ok: true,
        usdToEur,
        fetchedAt: cached?.fetchedAt || null,
        ecbDate: cached?.ecbDate || null,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  app.post('/api/ai-calls/exchange-rate/refresh', async (_req, res) => {
    try {
      const fresh = await fx.fetchLatestUsdToEur();
      res.json({
        ok: true,
        usdToEur: fresh.usdToEur,
        fetchedAt: fresh.fetchedAt,
        ecbDate: fresh.ecbDate,
      });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e.message || e) });
    }
  });
}

module.exports = { mountAiCostRoutes };
