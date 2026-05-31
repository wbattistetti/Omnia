import { describe, expect, it } from 'vitest';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { validateBackendOutputBindings } from '../validateBackendOutputBindings';
import { BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION } from '../types';

function makeUseCase(compiled: { tokenizedText: string; tokens: string[] }): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Test',
    sort_order: 1,
    dialogue: [{ role: 'agent', content: 'Ciao' }],
    phrases: [
      {
        phraseId: 'p1',
        naturalText: 'Il [12 giugno]',
        variants: [
          {
            variantId: 'default',
            compiled: {
              ...compiled,
              mappings: [{ surface: '12 giugno', slot_id: 'data' }],
              status: 'fresh',
              compiledAt: '2020-01-01T00:00:00.000Z',
            },
          },
        ],
      },
    ],
  } as AIAgentUseCase;
}

describe('validateBackendOutputBindings', () => {
  it('skips when no backends linked', () => {
    expect(
      validateBackendOutputBindings(
        [makeUseCase({ tokenizedText: 'Il [data]', tokens: ['data'] })],
        { schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION, rows: [], slotContracts: [] },
        false
      ).status
    ).toBe('skipped');
  });

  it('invalid when token data has no binding row', () => {
    const r = validateBackendOutputBindings(
      [makeUseCase({ tokenizedText: 'Il [data]', tokens: ['data'] })],
      { schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION, rows: [], slotContracts: [] },
      true
    );
    expect(r.status).toBe('invalid');
    expect(r.reasons.some((x) => x.includes('fillFrom'))).toBe(true);
  });

  it('valid when binding covers slot data', () => {
    const r = validateBackendOutputBindings(
      [makeUseCase({ tokenizedText: 'Il [data]', tokens: ['data'] })],
      {
        schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
        rows: [
          {
            backendTaskId: 'bk1',
            apiPath: 'slots[].date',
            slotId: 'data',
            tokenInPhrase: 'data',
          },
        ],
        slotContracts: [],
      },
      true
    );
    expect(r.status).toBe('valid');
  });

  it('invalid when contract exists without toolName', () => {
    const r = validateBackendOutputBindings(
      [makeUseCase({ tokenizedText: 'Il [data]', tokens: ['data'] })],
      {
        schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
        rows: [],
        slotContracts: [
          {
            slotId: 'data',
            toolName: '',
            backendTaskId: 'bk1',
            receive: 'slots[].date',
          },
        ],
      },
      true
    );
    expect(r.status).toBe('invalid');
    expect(r.reasons.some((x) => x.includes('toolName'))).toBe(true);
  });
});
