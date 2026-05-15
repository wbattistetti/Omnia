/**
 * Fetches a Bearer access token from FastAPI portal auth (for designer Test API proxy).
 */

const FASTAPI_BASE = (process.env.OMNIA_FASTAPI_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');

/**
 * @param {string} connectionId
 * @returns {Promise<string>}
 */
async function fetchPortalBearerToken(connectionId) {
  const cid = String(connectionId || '').trim();
  if (!cid) {
    throw new Error('portalConnectionId mancante');
  }
  const url = `${FASTAPI_BASE}/api/auth/portal/access-token?connection_id=${encodeURIComponent(cid)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      const d = j.detail;
      if (typeof d === 'object' && d && typeof d.message === 'string') msg = d.message;
      else if (typeof d === 'string') msg = d;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const body = await res.json();
  const token = body && typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
  if (!token) throw new Error('Risposta access-token senza accessToken');
  return token;
}

module.exports = { fetchPortalBearerToken };
