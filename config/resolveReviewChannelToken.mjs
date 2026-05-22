/**
 * Risolve il token canale review per dev/build (legge backend/.env se manca VITE_*).
 */

import fs from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';

/**
 * @param {string} repoRoot — root monorepo Omnia
 * @param {Record<string, string>} [viteEnv]
 * @returns {string}
 */
export function resolveReviewChannelToken(repoRoot, viteEnv = {}) {
  const fromVite = String(viteEnv.VITE_AGENT_REVIEW_CHANNEL_TOKEN ?? '').trim();
  if (fromVite) return fromVite;

  const backendEnvPath = path.join(repoRoot, 'backend', '.env');
  if (!fs.existsSync(backendEnvPath)) return '';

  const parsed = dotenvConfig({ path: backendEnvPath }).parsed ?? {};
  return String(parsed.AGENT_REVIEW_CHANNEL_TOKEN ?? '').trim();
}

/**
 * Proxy Vite: aggiunge X-Review-Token se la richiesta non ne ha già uno valido.
 * @param {string} expectedToken
 */
export function reviewChannelProxyOnProxyReq(expectedToken) {
  const expected = String(expectedToken ?? '').trim();
  if (!expected) return undefined;

  return (proxyReq, req) => {
    const existing =
      proxyReq.getHeader('x-review-token') ||
      proxyReq.getHeader('X-Review-Token') ||
      '';
    if (String(existing).trim()) return;
    proxyReq.setHeader('X-Review-Token', expected);
  };
}
