/**
 * Costruisce richiesta HTTP allineata al mapping SEND Backend Call (apiParam → valori riga mock).
 * Euristica: GET/DELETE/HEAD → query string; altri metodi → JSON body oggetto flat.
 * Sostituisce placeholder `{nome}` nel path se il nome coincide con un apiParam.
 */

import type { MappingEntry } from '../../components/FlowMappingPanel/mappingTypes';
import { stableJsonStringify } from '../stableJsonStringify';
import { coerceMockCellValue } from './coerceMockCellValue';

export type BuiltBackendHttpRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** Corpo JSON per POST/PUT/PATCH; null se non applicabile. */
  bodyJson: string | null;
};

function buildValuesByApiParam(
  sendEntries: MappingEntry[],
  rowInputs: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of sendEntries) {
    const api = (e.apiField || '').trim();
    if (!api) continue;
    const wire = (e.wireKey || '').trim();
    if (!wire) continue;
    const raw = rowInputs[wire];
    out[api] = coerceMockCellValue(raw);
  }
  return out;
}

function substitutePathParams(
  urlStr: string,
  values: Record<string, unknown>
): { url: string; used: Set<string> } {
  let u = urlStr;
  const used = new Set<string>();
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  const s = urlStr;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(s)) !== null) {
    const name = m[1].trim();
    if (name in values) {
      used.add(name);
      const v = values[name];
      const enc = encodeURIComponent(v === null || v === undefined ? '' : String(v));
      u = u.split(`{${name}}`).join(enc);
    }
  }
  return { url: u, used };
}

export function buildSendHttpRequest(params: {
  endpointUrl: string;
  method: string;
  endpointHeaders?: Record<string, string>;
  sendEntries: MappingEntry[];
  rowInputs: Record<string, unknown>;
}): BuiltBackendHttpRequest {
  const method = (params.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { ...(params.endpointHeaders || {}) };
  const values = buildValuesByApiParam(params.sendEntries, params.rowInputs);

  let pathPart = params.endpointUrl.trim();
  let queryFromUrl = '';
  const qIdx = pathPart.indexOf('?');
  if (qIdx >= 0) {
    queryFromUrl = pathPart.slice(qIdx + 1);
    pathPart = pathPart.slice(0, qIdx);
  }

  const sub = substitutePathParams(pathPart, values);
  const basePath = sub.url;
  const pathUsed = sub.used;

  const remainingForBodyOrQuery: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!pathUsed.has(k)) {
      remainingForBodyOrQuery[k] = v;
    }
  }

  const methodUp = method;
  const useQuery = methodUp === 'GET' || methodUp === 'HEAD' || methodUp === 'DELETE';

  if (useQuery) {
    const sp = new URLSearchParams(queryFromUrl);
    for (const [k, v] of Object.entries(remainingForBodyOrQuery)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'object') {
        sp.set(k, stableJsonStringify(v));
      } else {
        sp.set(k, String(v));
      }
    }
    const qs = sp.toString();
    const url = qs ? `${basePath}?${qs}` : basePath;
    return { url, method: methodUp, headers, bodyJson: null };
  }

  let urlWithOptionalQuery = basePath;
  if (queryFromUrl) {
    urlWithOptionalQuery = `${basePath}?${queryFromUrl}`;
  }

  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  const bodyJson = stableJsonStringify(remainingForBodyOrQuery);
  return { url: urlWithOptionalQuery, method: methodUp, headers, bodyJson };
}
