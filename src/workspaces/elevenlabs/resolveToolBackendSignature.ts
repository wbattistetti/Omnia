/**
 * Resolves SEND/RECEIVE field names for an ElevenLabs tool URL via OpenAPI discovery (read-only preview).
 */

import {
  extractOperationFields,
  fetchOpenApiDocumentOperationalThenManualFallback,
  pickOpenApiPathForReadApi,
} from '@services/openApiBackendCallSpec';
import { buildBackendCallRowsFromOpenApiFields } from './buildBackendCallRowsFromOpenApiFields';
import type {
  BackendCallInputRow,
  BackendCallOutputRow,
} from '@components/FlowMappingPanel/backendCallMappingAdapter';

export const BACKEND_SIGNATURE_READ_FAILURE_MESSAGE =
  'Non sono riuscito a leggere la firma del backend.';

export type ResolvedToolBackendSignature = {
  inputs: BackendCallInputRow[];
  outputs: BackendCallOutputRow[];
  sourceUrl: string;
  resolvedMethod: string;
  openApiPath: string;
  inputUiKindByWireKey: Record<string, string>;
  inputEnumByWireKey: Record<string, string[]>;
};

export type ResolveToolBackendSignatureResult =
  | { ok: true; signature: ResolvedToolBackendSignature }
  | { ok: false; message: string; detail?: string };

function normalizeMethodHint(m: string | undefined): string {
  const u = String(m || 'POST')
    .trim()
    .toUpperCase();
  if (u === 'GET' || u === 'POST' || u === 'PUT' || u === 'DELETE' || u === 'PATCH') return u;
  return 'POST';
}

/**
 * Loads OpenAPI from the operational URL (standard candidate heuristics), picks the operation, returns rows.
 */
export async function resolveToolBackendSignature(
  operationalUrl: string,
  httpMethod?: string
): Promise<ResolveToolBackendSignatureResult> {
  const url = operationalUrl.trim();
  if (!url) {
    return {
      ok: false,
      message: BACKEND_SIGNATURE_READ_FAILURE_MESSAGE,
      detail: 'URL endpoint mancante.',
    };
  }

  const methodHint = normalizeMethodHint(httpMethod);

  try {
    const { doc, sourceUrl } = await fetchOpenApiDocumentOperationalThenManualFallback(url);
    const picked = pickOpenApiPathForReadApi(url, doc, methodHint);
    if ('error' in picked) {
      return {
        ok: false,
        message: BACKEND_SIGNATURE_READ_FAILURE_MESSAGE,
        detail: picked.error,
      };
    }

    const fields = extractOperationFields(doc, picked.pathKey, picked.method);
    if (!fields) {
      return {
        ok: false,
        message: BACKEND_SIGNATURE_READ_FAILURE_MESSAGE,
        detail: `Operazione ${methodHint} non trovata per ${picked.pathKey}.`,
      };
    }

    const inputNames = [
      ...new Set([...fields.requestParamNames, ...fields.requestBodyPropertyNames]),
    ].filter(Boolean);
    const outputNames = fields.responsePropertyNames.filter(Boolean);
    if (inputNames.length === 0 && outputNames.length === 0) {
      return {
        ok: false,
        message: BACKEND_SIGNATURE_READ_FAILURE_MESSAGE,
        detail: 'OpenAPI trovato ma senza parametri SEND/RECEIVE per questa operazione.',
      };
    }

    const { inputs, outputs, inputUiKindByWireKey, inputEnumByWireKey } =
      buildBackendCallRowsFromOpenApiFields(fields);

    return {
      ok: true,
      signature: {
        inputs,
        outputs,
        sourceUrl,
        resolvedMethod: picked.method.toUpperCase(),
        openApiPath: picked.pathKey,
        inputUiKindByWireKey,
        inputEnumByWireKey,
      },
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: BACKEND_SIGNATURE_READ_FAILURE_MESSAGE,
      detail,
    };
  }
}
