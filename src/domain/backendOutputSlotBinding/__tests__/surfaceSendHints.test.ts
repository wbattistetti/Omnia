import { describe, expect, it } from 'vitest';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import { proposeSurfaceSendHint } from '../surfaceSendHints';

const BOOK_LEAVES: BackendSendParamLeaf[] = [
  {
    path: 'queryConstraints.horizon.start',
    type: 'string',
    format: 'date',
    semanticRole: 'horizon_start',
  },
  {
    path: 'queryConstraints.horizon.end',
    type: 'string',
    format: 'date',
    semanticRole: 'horizon_end',
  },
];

describe('proposeSurfaceSendHint', () => {
  it('maps fine mese to horizon.end', () => {
    const hint = proposeSurfaceSendHint('fine mese', 'datarelativa', BOOK_LEAVES);
    expect(hint).toMatchObject({
      surface: 'fine mese',
      slotId: 'datarelativa',
      role: 'constraint',
      sendPath: 'queryConstraints.horizon.end',
      valueKind: 'end_of_month',
    });
  });

  it('maps domani to horizon.start', () => {
    const hint = proposeSurfaceSendHint('domani', 'datarelativa', BOOK_LEAVES);
    expect(hint?.sendPath).toBe('queryConstraints.horizon.start');
    expect(hint?.valueKind).toBe('tomorrow');
  });

  it('returns null when allowlist empty', () => {
    expect(proposeSurfaceSendHint('fine mese', 'datarelativa', [])).toBeNull();
  });
});
