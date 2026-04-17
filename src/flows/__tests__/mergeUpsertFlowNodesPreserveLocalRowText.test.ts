import { describe, it, expect } from 'vitest';
import { mergeUpsertNodesPreserveLocalRowText } from '../mergeUpsertFlowNodesPreserveLocalRowText';

describe('mergeUpsertNodesPreserveLocalRowText', () => {
  it('returns incoming when prev has no local changes', () => {
    const incoming = [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'server' }] } }];
    const prev = { hasLocalChanges: false, nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: '' }] } }] };
    expect(mergeUpsertNodesPreserveLocalRowText(prev, incoming)).toEqual(incoming);
  });

  it('preserves local row text for matching node and row ids when hasLocalChanges', () => {
    const incoming = [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'stale' }] } }];
    const prev = { hasLocalChanges: true, nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: '' }] } }] };
    const out = mergeUpsertNodesPreserveLocalRowText(prev, incoming) as typeof incoming;
    expect(out[0].data.rows[0].text).toBe('');
  });

  it('keeps incoming row when row id only exists on incoming', () => {
    const incoming = [{ id: 'n1', data: { rows: [{ id: 'r2', text: 'new' }] } }];
    const prev = { hasLocalChanges: true, nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'a' }] } }] };
    const out = mergeUpsertNodesPreserveLocalRowText(prev, incoming) as typeof incoming;
    expect(out[0].data.rows[0].text).toBe('new');
  });

  it('returns same array reference when incoming.nodes === prev.nodes (translation-only upsert)', () => {
    const nodes = [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'x' }] } }];
    const prev = { hasLocalChanges: true, nodes };
    const out = mergeUpsertNodesPreserveLocalRowText(prev, nodes);
    expect(out).toBe(nodes);
  });
});
