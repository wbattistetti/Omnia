import { describe, expect, it } from 'vitest';
import {
  pickSendLeafForBound,
  type BackendSendParamLeaf,
} from '../backendSendParamCatalog';

describe('pickSendLeafForBound', () => {
  const leaves: BackendSendParamLeaf[] = [
    {
      path: 'filters.dateTo',
      type: 'string',
      format: 'date',
      semanticRole: 'horizon_end',
    },
    {
      path: 'filters.dateFrom',
      type: 'string',
      format: 'date',
      semanticRole: 'horizon_start',
    },
  ];

  it('picks generic dateTo for end bound', () => {
    expect(pickSendLeafForBound(leaves, 'end')?.path).toBe('filters.dateTo');
  });

  it('picks generic dateFrom for start bound', () => {
    expect(pickSendLeafForBound(leaves, 'start')?.path).toBe('filters.dateFrom');
  });
});
