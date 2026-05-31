import { describe, expect, it } from 'vitest';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import {
  buildParameterDestinationCatalog,
  proposeDestinationForSurface,
  proposeSendHintFromDestinationCatalog,
  groupDestinationsByBackend,
} from '../parameterDestinationTree';
import { buildDestinationPathTree } from '../destinationPathTree';
import { resolveCanonicalSlotIdFromToken } from '../resolveCanonicalSlotId';

const BOOK_LEAVES: BackendSendParamLeaf[] = [
  {
    path: 'constraints.horizon.end',
    type: 'string',
    semanticRole: 'horizon_end',
  },
  {
    path: 'constraints.horizon.start',
    type: 'string',
    semanticRole: 'horizon_start',
  },
];

describe('parameterDestinationTree', () => {
  it('builds send and receive groups', () => {
    const catalog = buildParameterDestinationCatalog(
      [{ backendTaskId: 'bk1', toolName: 'next_window', leaves: BOOK_LEAVES }],
      [
        {
          backendTaskId: 'bk1',
          toolName: 'next_window',
          leaves: [{ path: 'slots[].date', suggestedSlotId: 'data' }],
        },
      ]
    );
    const { backends, semantic } = groupDestinationsByBackend(catalog);
    expect(semantic).toEqual([]);
    expect(backends).toHaveLength(1);
    expect(backends[0]!.receiveDestinations).toHaveLength(1);
    expect(backends[0]!.receiveDestinations[0]!.receivePath).toBe('slots[].date');
    expect(backends[0]!.sendDestinations.some((d) => d.sendPath === 'constraints.horizon.end')).toBe(
      true
    );
  });

  it('builds nested path tree for UI', () => {
    const catalog = buildParameterDestinationCatalog(
      [{ backendTaskId: 'bk1', toolName: 'next_window', leaves: BOOK_LEAVES }],
      []
    );
    const send = catalog.filter((d) => d.kind === 'send');
    const tree = buildDestinationPathTree(send);
    expect(tree.some((n) => n.segment === 'constraints')).toBe(true);
    expect(tree[0]?.children.some((c) => c.segment === 'horizon')).toBe(true);
  });

  it('proposes fine mese via catalog auto-mapping', () => {
    const catalog = buildParameterDestinationCatalog(
      [{ backendTaskId: 'bk1', toolName: 'slots', leaves: BOOK_LEAVES }],
      []
    );
    const dest = proposeDestinationForSurface('fine mese', 'datarelativa', catalog);
    expect(dest?.kind).toBe('send');
    expect(dest?.valueKind).toBe('end_of_month');
    expect(dest?.sendPath).toBe('constraints.horizon.end');

    const hint = proposeSendHintFromDestinationCatalog('fine mese', 'datarelativa', catalog);
    expect(hint?.role).toBe('constraint');
    expect(hint?.backendTaskId).toBe('bk1');
  });

  it('includes semantic-only destinations', () => {
    const catalog = buildParameterDestinationCatalog([], [], ['prestazione', 'nome']);
    expect(catalog.filter((d) => d.kind === 'semantic')).toHaveLength(2);
  });
});

describe('resolveCanonicalSlotIdFromToken', () => {
  it('maps giorno_N to data', () => {
    expect(resolveCanonicalSlotIdFromToken('giorno_1')).toBe('data');
    expect(resolveCanonicalSlotIdFromToken('ora_2')).toBe('orario');
  });
});
