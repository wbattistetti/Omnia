/**
 * Lettura normalizzata dell’endpoint HTTP da un task Backend Call (editor / ConvAI tools).
 */

import type { BackendCallSpecMeta } from '@domain/backendCatalog/catalogTypes';
import type { Task } from '@types/taskTypes';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

export function normalizeHttpMethod(m: string | undefined, fallback = 'GET'): string {
  const u = String(m ?? fallback).trim().toUpperCase();
  return ALLOWED_METHODS.has(u) ? u : fallback;
}

function readSpecMeta(task: Task): BackendCallSpecMeta | undefined {
  const meta = (task as Task & { backendCallSpecMeta?: BackendCallSpecMeta }).backendCallSpecMeta;
  return meta && typeof meta === 'object' ? meta : undefined;
}

/**
 * Metodo HTTP effettivo per export ConvAI / webhook: endpoint persistito, lock OpenAPI, euristiche POST.
 */
export function resolveBackendCallHttpMethod(task: Task, endpointUrl: string): string {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string } }).endpoint;
  const url = endpointUrl.trim();
  let method = normalizeHttpMethod(
    ep && typeof ep.method === 'string' ? ep.method : undefined,
    'GET'
  );

  const meta = readSpecMeta(task);
  if (
    meta?.openApiMethodLocked &&
    meta.importState === 'ok' &&
    typeof meta.openApiLockedHttpMethod === 'string' &&
    meta.openApiLockedHttpMethod.trim()
  ) {
    const snap = String(meta.openApiMethodLockUrlSnapshot ?? '').trim();
    const taskUrl = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
    const compareUrl = url || taskUrl;
    if (!snap || snap === compareUrl) {
      method = normalizeHttpMethod(meta.openApiLockedHttpMethod, method);
    }
  }

  const urlLower = url.toLowerCase();
  if (urlLower.includes('bookfromagenda') || urlLower.includes('next-window')) {
    return 'POST';
  }

  const bodyProps = meta?.openapiRequestBodyPropertyNames;
  if (
    method === 'GET' &&
    Array.isArray(bodyProps) &&
    bodyProps.length > 0 &&
    meta?.importState === 'ok'
  ) {
    return 'POST';
  }

  return method;
}

export function readBackendCallEndpoint(task: Task): {
  url: string;
  method: string;
  headers: Record<string, string>;
} {
  const ep = (task as Task & { endpoint?: { url?: string; method?: string; headers?: Record<string, string> } })
    .endpoint;
  const url = ep && typeof ep.url === 'string' ? ep.url.trim() : '';
  const method = resolveBackendCallHttpMethod(task, url);
  const raw = ep && typeof ep.headers === 'object' && ep.headers ? ep.headers : {};
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) headers[k] = v;
  }
  return { url, method, headers };
}
