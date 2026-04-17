import { describe, it, expect } from 'vitest';
import { overlayInboundFlowRowsWithAuthoritativeSlice } from '../overlayInboundFlowRowsWithAuthoritativeSlice';

describe('overlayInboundFlowRowsWithAuthoritativeSlice', () => {
  it('copies row text from authoritative slice when stale inbound differs', () => {
    const authoritative = {
      nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: '' }] } }],
    };
    const incoming = { nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'stale' }] } }] };
    const out = overlayInboundFlowRowsWithAuthoritativeSlice(authoritative, incoming)!;
    expect((out[0] as any).data.rows[0].text).toBe('');
  });

  it('leaves incoming rows when authoritative has no matching node', () => {
    const authoritative = { nodes: [] };
    const incoming = { nodes: [{ id: 'n1', data: { rows: [{ id: 'r1', text: 'only' }] } }] };
    const out = overlayInboundFlowRowsWithAuthoritativeSlice(authoritative, incoming)!;
    expect((out[0] as any).data.rows[0].text).toBe('only');
  });
});
