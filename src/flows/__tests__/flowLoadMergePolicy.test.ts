import { describe, expect, it } from 'vitest';
import {
  mergeFlowMetaOnServerLoad,
  mergeMetaTranslationTables,
  shouldKeepLocalGraphOnEmptyServerResponse,
} from '../flowLoadMergePolicy';

describe('shouldKeepLocalGraphOnEmptyServerResponse', () => {
  it('returns true when server is empty, local has nodes, and slice is dirty', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 2,
        hasLocalChanges: true,
        flowId: 'main',
      })
    ).toBe(true);
  });

  it('returns false when server has nodes', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 1,
        localNodeCount: 2,
        hasLocalChanges: true,
      })
    ).toBe(false);
  });

  it('returns false when local has no nodes', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 0,
        hasLocalChanges: true,
      })
    ).toBe(false);
  });

  it('returns false for main flow when hasLocalChanges is not true', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 3,
        hasLocalChanges: false,
        flowId: 'main',
      })
    ).toBe(false);
  });

  it('returns true for subflow slice when server empty and local has nodes even if dirty flag lags', () => {
    expect(
      shouldKeepLocalGraphOnEmptyServerResponse({
        serverNodeCount: 0,
        localNodeCount: 2,
        hasLocalChanges: false,
        flowId: 'subflow_x',
      })
    ).toBe(true);
  });
});

describe('mergeFlowMetaOnServerLoad', () => {
  const localRich = {
    flowInterface: {
      input: [{ id: 'in1' }],
      output: [{ id: 'out1' }, { id: 'out2' }],
    },
    translations: { 'flowInterface.output.out1': { it: 'A' } },
  };

  it('preserves local flowInterface when subflow id and server has empty interface rows', () => {
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'subflow_abc',
      localMeta: localRich as any,
      serverMeta: { flowInterface: { input: [], output: [] } } as any,
      hasLocalChanges: false,
    });
    expect(out?.flowInterface?.output).toHaveLength(2);
    expect(out?.flowInterface?.input).toHaveLength(1);
  });

  it('preserves local flowInterface when main flow is dirty and server interface is poorer', () => {
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'main',
      localMeta: localRich as any,
      serverMeta: { flowInterface: { input: [], output: [] } } as any,
      hasLocalChanges: true,
    });
    expect(out?.flowInterface?.output).toHaveLength(2);
  });

  it('does not preserve local interface when main flow is clean and not a subflow', () => {
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'main',
      localMeta: localRich as any,
      serverMeta: { flowInterface: { input: [], output: [] } } as any,
      hasLocalChanges: false,
    });
    expect(out?.flowInterface?.output).toHaveLength(0);
  });

  it('returns local meta when server meta is undefined', () => {
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'main',
      localMeta: localRich as any,
      serverMeta: undefined,
      hasLocalChanges: false,
    });
    expect(out).toEqual(localRich);
  });

  it('union-merges translations so local-only var keys survive stale inbound upserts', () => {
    const localMeta = {
      translations: {
        'var:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee': 'Nuovo nome',
      },
    } as any;
    const serverMeta = {
      translations: {},
    } as any;
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'main',
      localMeta,
      serverMeta,
      hasLocalChanges: true,
    });
    expect(out?.translations?.['var:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']).toBe('Nuovo nome');
  });

  it('on same key prefers server translations when slice is dirty', () => {
    const vid = 'var:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'main',
      localMeta: { translations: { [vid]: 'Local' } } as any,
      serverMeta: { translations: { [vid]: 'Server' } } as any,
      hasLocalChanges: true,
    });
    expect(out?.translations?.[vid]).toBe('Server');
  });

  it('on same key prefers server translations when slice is clean', () => {
    const vid = 'var:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const out = mergeFlowMetaOnServerLoad({
      flowId: 'main',
      localMeta: { translations: { [vid]: 'Local' } } as any,
      serverMeta: { translations: { [vid]: 'Server' } } as any,
      hasLocalChanges: false,
    });
    expect(out?.translations?.[vid]).toBe('Server');
  });
});

describe('mergeMetaTranslationTables', () => {
  it('keeps keys present only on the local table', () => {
    const out = mergeMetaTranslationTables(
      { 'var:a': 'L' } as any,
      {} as any
    );
    expect(out?.['var:a']).toBe('L');
  });

  it('incoming wins on conflict', () => {
    const out = mergeMetaTranslationTables(
      { 'var:a': 'old' } as any,
      { 'var:a': 'new' } as any
    );
    expect(out?.['var:a']).toBe('new');
  });
});
