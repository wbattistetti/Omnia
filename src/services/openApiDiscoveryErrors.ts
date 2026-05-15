/**
 * OpenAPI discovery failed (distinct from portal login required).
 */

export const OPENAPI_NOT_FOUND_CODE = 'OPENAPI_NOT_FOUND' as const;

export class OpenApiNotFoundError extends Error {
  readonly code = OPENAPI_NOT_FOUND_CODE;

  constructor(
    message: string,
    readonly portalAuthenticated = false
  ) {
    super(message);
    this.name = 'OpenApiNotFoundError';
  }
}

export function parseOpenApiNotFoundDetail(
  detail: unknown,
  portalAuthenticated: boolean
): OpenApiNotFoundError | null {
  if (typeof detail === 'object' && detail !== null) {
    const d = detail as { code?: string; message?: string; authenticated?: boolean };
    if (d.code === OPENAPI_NOT_FOUND_CODE || d.code === 'OPENAPI_NOT_FOUND') {
      const auth = Boolean(d.authenticated ?? portalAuthenticated);
      return new OpenApiNotFoundError(
        typeof d.message === 'string' && d.message.trim()
          ? d.message
          : defaultOpenApiNotFoundMessage(auth),
        auth
      );
    }
  }
  if (typeof detail === 'string' && detail.includes('OPENAPI_NOT_FOUND')) {
    try {
      const j = JSON.parse(detail) as { message?: string; authenticated?: boolean };
      return new OpenApiNotFoundError(
        j.message || defaultOpenApiNotFoundMessage(Boolean(j.authenticated)),
        Boolean(j.authenticated)
      );
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function defaultOpenApiNotFoundMessage(portalAuthenticated: boolean): string {
  if (portalAuthenticated) {
    return (
      'Accesso al portale riuscito, ma non è stato trovato alcun documento OpenAPI/Swagger su questo URL. ' +
      'Incolla l’URL diretto del file JSON (es. …/swagger.json o …/v3/api-docs), non solo /webhook. ' +
      'Se il servizio risponde 503, verifica che sia online e che l’URL sia quello indicato dal team.'
    );
  }
  return (
    'Impossibile caricare OpenAPI su questo URL. Usa l’URL del JSON swagger o la base API corretta.'
  );
}
