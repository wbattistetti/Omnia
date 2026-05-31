/**
 * Regole lessicali IT → slot / valueKind / ruolo SEND (design-time e catalogo destinazioni).
 */

import type { BackendSendSemanticRole } from '@domain/openApi/backendSendParamCatalog';
import type { TokenSendRole } from './types';

export type SurfaceSendRule = {
  pattern: RegExp;
  slotId: string;
  role: TokenSendRole;
  valueKind: string;
  preferSemanticRole: BackendSendSemanticRole;
};

export const SURFACE_SEND_RULES: readonly SurfaceSendRule[] = [
  {
    pattern: /^fine\s+(del\s+)?mese$/i,
    slotId: 'datarelativa',
    role: 'constraint',
    valueKind: 'end_of_month',
    preferSemanticRole: 'horizon_end',
  },
  {
    pattern: /^inizio\s+(del\s+)?mese$/i,
    slotId: 'datarelativa',
    role: 'constraint',
    valueKind: 'start_of_month',
    preferSemanticRole: 'horizon_start',
  },
  {
    pattern: /^domani$/i,
    slotId: 'datarelativa',
    role: 'value',
    valueKind: 'tomorrow',
    preferSemanticRole: 'horizon_start',
  },
  {
    pattern: /^dopodomani$/i,
    slotId: 'datarelativa',
    role: 'value',
    valueKind: 'day_after_tomorrow',
    preferSemanticRole: 'horizon_start',
  },
  {
    pattern: /^oggi$/i,
    slotId: 'datarelativa',
    role: 'value',
    valueKind: 'today',
    preferSemanticRole: 'horizon_start',
  },
  {
    pattern: /^\d{1,2}\s+[a-zàèéìòù]+(?:\s+\d{4})?$/i,
    slotId: 'data',
    role: 'value',
    valueKind: 'specific_date',
    preferSemanticRole: 'horizon_start',
  },
  {
    pattern: /^\d{1,2}:\d{2}$/,
    slotId: 'orario',
    role: 'value',
    valueKind: 'specific_time',
    preferSemanticRole: 'other',
  },
];
