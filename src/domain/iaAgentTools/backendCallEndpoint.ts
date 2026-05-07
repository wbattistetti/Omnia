/**
 * Lettura normalizzata dell’endpoint HTTP da un task Backend Call (editor / ConvAI tools).
 */

import type { Task } from '@types/taskTypes';

function normalizeHttpMethod(m: string | undefined): string {
  const u = (m || 'GET').toUpperCase();
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(u) ? u : 'GET';
}

export function readBackendCallEndpoint(task: Task): {
  url: string;
  method: string;
  headers: Record<string, string>;
} {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string; headers?: Record<string, string> } })
    .endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
  const method = normalizeHttpMethod(ep && typeof ep.method === 'string' ? ep.method : undefined);
  const raw = ep && typeof ep.headers === 'object' && ep.headers ? ep.headers : {};
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) headers[k] = v;
  }
  return { url, method, headers };
}
