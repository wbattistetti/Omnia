import { describe, expect, it } from 'vitest';
import { buildElevenLabsStyleEdge } from '../workflowEdgeStyle';

describe('buildElevenLabsStyleEdge', () => {
  it('renders edge labels without background chip', () => {
    const edge = buildElevenLabsStyleEdge({
      id: 'e1',
      sourceNodeId: 'a',
      targetNodeId: 'b',
      conditionKind: 'unconditional',
    });
    expect(edge.label).toBe('sempre');
    expect(edge.labelBgStyle).toBeUndefined();
    expect(edge.labelStyle?.fill).toBe('#e2e8f0');
    expect(edge.labelStyle?.stroke).toBeUndefined();
  });
});
