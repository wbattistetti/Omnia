/**
 * contract-extract HTTP client: tests use a fetch mock returning VB-shaped JSON (no TS extraction).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NLPContract } from '../contracts/contractLoader';

function mockContractExtractFixture() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      const u = String(input);
      if (!u.includes('/api/nlp/contract-extract')) {
        throw new Error(`Unexpected fetch URL in test: ${u}`);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          values: { day: '12', month: '05', year: '1990' },
          hasMatch: true,
          engine: 'vb-fixture',
        }),
      };
    })
  );
}

describe('VB contract-extract client (mocked)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockContractExtractFixture();
  });

  it('maps POST body and parses subId-keyed values from fixture', async () => {
    const contract: NLPContract = {
      templateName: 'date',
      templateId: 't1',
      subDataMapping: {
        day: { groupName: 'day', label: 'Day', type: 'number' },
        month: { groupName: 'month', label: 'Month', type: 'number' },
        year: { groupName: 'year', label: 'Year', type: 'number' },
      },
      engines: [{ type: 'regex', enabled: true, patterns: ['.*'], examples: [] }],
    };

    const { extractWithVbContract } = await import('../../../services/vbContractExtract');
    const r = await extractWithVbContract('12/05/1990', contract, true);
    expect(r.hasMatch).toBe(true);
    expect(r.values.day).toBe('12');
    expect(r.values.month).toBe('05');
    expect(r.values.year).toBe('1990');
  });
});
