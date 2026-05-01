/**
 * Legge OpenAPI da URL (stesso stack del Backend Call) per voci catalogo manuale.
 */

import {
  extractOperationFields,
  fetchOpenApiDocument,
  pickOpenApiPathForReadApi,
} from '../../services/openApiBackendCallSpec';
import { hashString, structuralFingerprint } from '../../domain/backendCatalog';

export type CatalogOpenApiImportOk = {
  ok: true;
  contentHash: string;
  structuralFingerprint: string;
  inputNames: string[];
  outputNames: string[];
};

export type CatalogOpenApiImportErr = { ok: false; error: string };

/**
 * @param url — endpoint o documento OpenAPI (come campo URL Backend Call)
 * @param method — metodo HTTP operazione
 */
export async function importOpenApiForCatalogUrl(
  url: string,
  method: string
): Promise<CatalogOpenApiImportOk | CatalogOpenApiImportErr> {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: 'URL vuoto' };
  try {
    const { doc } = await fetchOpenApiDocument(trimmed);
    const picked = pickOpenApiPathForReadApi(trimmed, doc, method);
    if ('error' in picked) return { ok: false, error: picked.error };
    const fields = extractOperationFields(doc, picked.pathKey, method);
    if (!fields) {
      return { ok: false, error: `Operazione ${method} non trovata per ${picked.pathKey}.` };
    }
    const inputNames = [...new Set([...fields.requestParamNames, ...fields.requestBodyPropertyNames])].filter(
      Boolean
    );
    const outputNames = fields.responsePropertyNames.filter(Boolean);
    const contentHash = hashString(JSON.stringify(doc));
    const structuralFp = structuralFingerprint(method, trimmed);
    return {
      ok: true,
      contentHash,
      structuralFingerprint: structuralFp,
      inputNames,
      outputNames,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
