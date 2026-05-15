/**
 * Errors raised when OpenAPI fetch requires portal login.
 */

import {
  PORTAL_AUTH_EXPIRED_CODE,
  PORTAL_AUTH_REQUIRED_CODE,
} from '@domain/portalAuth/portalConnectionTypes';

export class PortalAuthRequiredError extends Error {
  readonly code = PORTAL_AUTH_REQUIRED_CODE;
  constructor(
    readonly origin: string,
    message?: string
  ) {
    super(
      message ??
        'Il portale richiede l’accesso. Connetti il tuo account per recuperare le specifiche.'
    );
    this.name = 'PortalAuthRequiredError';
  }
}

export class PortalAuthExpiredError extends Error {
  readonly code = PORTAL_AUTH_EXPIRED_CODE;
  constructor(
    readonly origin: string,
    message?: string
  ) {
    super(message ?? 'Sessione portale scaduta. Riconnetti il tuo account.');
    this.name = 'PortalAuthExpiredError';
  }
}

function parsePortalAuthDetailObject(
  detail: Record<string, unknown>
): PortalAuthRequiredError | PortalAuthExpiredError | null {
  const d = detail as { code?: string; message?: string; origin?: string };
  const origin = typeof d.origin === 'string' ? d.origin : '';
  if (d.code === PORTAL_AUTH_EXPIRED_CODE) {
    return new PortalAuthExpiredError(origin, d.message);
  }
  if (d.code === PORTAL_AUTH_REQUIRED_CODE || d.code === 'PORTAL_AUTH_REQUIRED') {
    return new PortalAuthRequiredError(origin, d.message);
  }
  return null;
}

export function parsePortalAuthHttpError(
  status: number,
  detail: unknown
): PortalAuthRequiredError | PortalAuthExpiredError | null {
  if (typeof detail === 'object' && detail !== null) {
    const parsed = parsePortalAuthDetailObject(detail as Record<string, unknown>);
    if (parsed) return parsed;
  }
  if (typeof detail === 'string' && detail.includes('PORTAL_AUTH_REQUIRED')) {
    try {
      const j = JSON.parse(detail) as { code?: string; origin?: string; message?: string };
      if (j && typeof j === 'object') {
        return parsePortalAuthDetailObject(j as Record<string, unknown>);
      }
    } catch {
      /* ignore */
    }
  }
  if (status !== 401 && status !== 422) return null;
  return null;
}

/**
 * Se il proxy non ha trovato OpenAPI ma l’URL sembra dietro login, apri il modale OAuth.
 */
export function inferPortalAuthFromFailedOpenApiFetch(
  endpointUrl: string,
  detail: unknown,
  httpStatus: number
): PortalAuthRequiredError | null {
  const structured = parsePortalAuthHttpError(httpStatus, detail);
  if (structured) return structured instanceof PortalAuthRequiredError ? structured : null;

  const text =
    typeof detail === 'string'
      ? detail
      : detail !== undefined
        ? JSON.stringify(detail)
        : '';
  const lower = text.toLowerCase();
  const looksLikeLoginWall =
    httpStatus === 401 ||
    httpStatus === 403 ||
    (httpStatus === 422 &&
      (lower.includes('portal_auth_required') ||
        lower.includes('login') ||
        lower.includes('html') ||
        lower.includes('autenticaz') ||
        lower.includes('probable login') ||
        lower.includes('probabile login') ||
        lower.includes('connetti il tuo account')));

  if (!looksLikeLoginWall) return null;

  try {
    const origin = new URL(endpointUrl.trim()).origin;
    return new PortalAuthRequiredError(origin);
  } catch {
    return new PortalAuthRequiredError('', undefined);
  }
}
