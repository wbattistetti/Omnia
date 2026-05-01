/**
 * Etichette UI per {@link SpecStaleReason} (tooltip catalogo read-only).
 */

import { SpecStaleReason } from '../../domain/backendCatalog/catalogTypes';

export function staleReasonLabel(reason: SpecStaleReason): string {
  switch (reason) {
    case SpecStaleReason.NO_CONTRACT:
      return 'Nessun contratto importato';
    case SpecStaleReason.STRUCTURAL_DRIFT:
      return 'Endpoint cambiato dopo ultimo import OpenAPI';
    case SpecStaleReason.IMPORT_ERROR:
      return 'Ultimo import OpenAPI fallito';
    case SpecStaleReason.FRESH:
      return 'Contratto allineato (ultimo Read API)';
    default:
      return String(reason);
  }
}
