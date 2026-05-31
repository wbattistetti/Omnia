import { describe, expect, it } from 'vitest';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import { proposeSurfaceSendHint } from '../surfaceSendHints';

const CRM_LEAVES: BackendSendParamLeaf[] = [
  {
    path: 'search.dateFrom',
    type: 'string',
    format: 'date',
    semanticRole: 'horizon_start',
  },
  {
    path: 'search.dateTo',
    type: 'string',
    format: 'date',
    semanticRole: 'horizon_end',
  },
];

describe('proposeSurfaceSendHint generic API', () => {
  it('maps fine mese to search.dateTo', () => {
    const hint = proposeSurfaceSendHint('fine mese', 'datarelativa', CRM_LEAVES);
    expect(hint?.sendPath).toBe('search.dateTo');
    expect(hint?.valueKind).toBe('end_of_month');
  });

  it('maps domani to search.dateFrom', () => {
    const hint = proposeSurfaceSendHint('domani', 'datarelativa', CRM_LEAVES);
    expect(hint?.sendPath).toBe('search.dateFrom');
    expect(hint?.valueKind).toBe('tomorrow');
  });
});
