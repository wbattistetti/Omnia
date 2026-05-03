/**
 * Testo chip collassato SEND: date ISO → gg/mm/aaaa, costanti Now/Tomorrow leggibili.
 */

import type { OpenApiInputUiKind } from '../../services/openApiBackendCallSpec';
import { valueToInputDisplay } from './dateSelectorPopoverUtils';

export function formatSendChipLiteralDisplay(
  literalConstant: string | undefined,
  openApiInputKind: OpenApiInputUiKind | undefined,
  apiField: string | undefined
): string {
  const t = literalConstant?.trim() ?? '';
  if (!t) return '';
  const api = (apiField || '').trim();
  const useDateUi = api === 'startDate' || openApiInputKind === 'date';
  if (useDateUi) return valueToInputDisplay(t);
  return t;
}
