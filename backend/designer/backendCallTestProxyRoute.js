/**
 * Designer-time HTTP proxy for Backend Call «Test API» (same JSON contract as VB ApiServer).
 * POST /api/designer/backend-call-test/proxy — body: { "target": { "url", "method", "headers", "bodyJson" } }.
 * Response: { ok, status, statusText, bodyText } or { ok:false, status:0, statusText:"ProxyError", bodyText:"", err }.
 */

const BACKEND_CALL_TEST_ALLOWED = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

function isHopByHopHeader(name) {
  const h = String(name || '').toLowerCase();
  return (
    h === 'host' ||
    h === 'connection' ||
    h === 'keep-alive' ||
    h === 'proxy-authenticate' ||
    h === 'proxy-authorization' ||
    h === 'te' ||
    h === 'trailers' ||
    h === 'transfer-encoding' ||
    h === 'upgrade'
  );
}

function bodyMayHaveContent(methodStr) {
  const m = String(methodStr || '').toUpperCase();
  return m !== 'GET' && m !== 'HEAD';
}

/**
 * @param {import('express').Express} app
 */
function mountBackendCallTestProxy(app) {
  app.post('/api/designer/backend-call-test/proxy', async (req, res) => {
    /** Same envelope as VB so the browser always parses one JSON shape (see forwardBackendCallViaProxy). */
    const envelopeErr = (status, statusText, err) =>
      res.status(200).json({
        ok: false,
        status,
        statusText,
        bodyText: '',
        err,
      });

    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return envelopeErr(400, 'Bad Request', 'Invalid body');
      }
      const target = body.target;
      if (!target || typeof target !== 'object') {
        return envelopeErr(400, 'Bad Request', 'Missing target object');
      }
      const urlStr = typeof target.url === 'string' ? target.url.trim() : '';
      if (!urlStr) {
        return envelopeErr(400, 'Bad Request', 'Missing target.url');
      }
      let parsedUrl;
      try {
        parsedUrl = new URL(urlStr);
      } catch {
        return envelopeErr(400, 'Bad Request', 'Invalid target.url');
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return envelopeErr(400, 'Bad Request', 'Only http/https URLs are allowed');
      }
      const methodStr = (
        typeof target.method === 'string' && target.method.trim()
          ? target.method.trim()
          : 'POST'
      ).toUpperCase();
      if (!BACKEND_CALL_TEST_ALLOWED.has(methodStr)) {
        return envelopeErr(400, 'Bad Request', 'Unsupported HTTP method');
      }
      const headersObj = target.headers && typeof target.headers === 'object' ? target.headers : {};
      const forwardHeaders = new Headers();
      for (const [k0, v0] of Object.entries(headersObj)) {
        const hn = String(k0 || '').trim();
        if (!hn || isHopByHopHeader(hn)) continue;
        forwardHeaders.set(hn, v0 == null ? '' : String(v0));
      }
      let bodyString = null;
      if (target.bodyJson !== undefined && target.bodyJson !== null) {
        bodyString =
          typeof target.bodyJson === 'string' ? target.bodyJson : JSON.stringify(target.bodyJson);
      }
      if (bodyMayHaveContent(methodStr) && bodyString != null && bodyString !== '') {
        forwardHeaders.delete('Content-Type');
        forwardHeaders.delete('content-type');
        forwardHeaders.set('Content-Type', 'application/json');
      }
      /** @type {RequestInit} */
      const init = {
        method: methodStr,
        headers: forwardHeaders,
        signal: AbortSignal.timeout(120000),
      };
      if (bodyMayHaveContent(methodStr) && bodyString != null && bodyString !== '') {
        init.body = bodyString;
      }
      try {
        const resp = await fetch(urlStr, init);
        const respText = await resp.text();
        return res.status(200).json({
          ok: resp.ok,
          status: resp.status,
          statusText: resp.statusText,
          bodyText: respText,
        });
      } catch (ex) {
        return res.status(200).json({
          ok: false,
          status: 0,
          statusText: 'ProxyError',
          bodyText: '',
          err: String(ex?.message || ex),
        });
      }
    } catch (e) {
      return envelopeErr(500, 'Internal Server Error', String(e?.message || e));
    }
  });
}

module.exports = { mountBackendCallTestProxy };
