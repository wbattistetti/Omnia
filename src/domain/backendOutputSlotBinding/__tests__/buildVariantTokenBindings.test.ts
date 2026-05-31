import { describe, expect, it } from 'vitest';
import { buildVariantTokenBindings } from '../buildVariantTokenBindings';
import { BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION } from '../types';

describe('buildVariantTokenBindings', () => {
  it('emits fillFrom per token', () => {
    const rows = buildVariantTokenBindings(
      {
        tokenizedText: 'Il [data] alle [orario]',
        tokens: ['data', 'orario'],
        mappings: [],
        status: 'fresh',
        compiledAt: '',
      },
      {
        schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
        rows: [
          {
            backendTaskId: 'bk1',
            apiPath: 'slots[].date',
            slotId: 'data',
            tokenInPhrase: 'data',
            format: 'YYYY-MM-DD',
          },
          {
            backendTaskId: 'bk1',
            apiPath: 'slots[].startTime',
            slotId: 'orario',
            tokenInPhrase: 'orario',
          },
        ],
        slotContracts: [],
      }
    );
    expect(rows).toEqual([
      { token: 'data', slotId: 'data', fillFrom: 'slots[].date', format: 'YYYY-MM-DD' },
      { token: 'orario', slotId: 'orario', fillFrom: 'slots[].startTime' },
    ]);
  });

  it('prefers slotContracts over rows', () => {
    const rows = buildVariantTokenBindings(
      {
        tokenizedText: 'Il [data]',
        tokens: ['data'],
        mappings: [],
        status: 'fresh',
        compiledAt: '',
      },
      {
        schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
        rows: [
          {
            backendTaskId: 'bk1',
            apiPath: 'legacy.path',
            slotId: 'data',
            tokenInPhrase: 'data',
          },
        ],
        slotContracts: [
          {
            slotId: 'data',
            toolName: 'get_slots',
            backendTaskId: 'bk1',
            receive: 'slots[].date',
            send: ['locationId'],
            format: 'YYYY-MM-DD',
          },
        ],
      }
    );
    expect(rows[0]).toEqual({
      token: 'data',
      slotId: 'data',
      fillFrom: 'slots[].date',
      toolName: 'get_slots',
      sendParams: ['locationId'],
      format: 'YYYY-MM-DD',
    });
  });

  it('attaches send hints from surface', () => {
    const rows = buildVariantTokenBindings(
      {
        tokenizedText: 'fino a [datarelativa]',
        tokens: ['datarelativa'],
        mappings: [{ surface: 'fine mese', slot_id: 'datarelativa' }],
        status: 'fresh',
        compiledAt: '',
      },
      {
        schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
        rows: [
          {
            backendTaskId: 'bk1',
            apiPath: 'slots[].date',
            slotId: 'datarelativa',
            tokenInPhrase: 'datarelativa',
          },
        ],
        slotContracts: [],
        sendHints: [
          {
            surface: 'fine mese',
            slotId: 'datarelativa',
            role: 'constraint',
            sendPath: 'queryConstraints.horizon.end',
            valueKind: 'end_of_month',
          },
        ],
      }
    );
    expect(rows[0]).toMatchObject({
      token: 'datarelativa',
      sendPath: 'queryConstraints.horizon.end',
      valueKind: 'end_of_month',
      role: 'constraint',
    });
  });
});
