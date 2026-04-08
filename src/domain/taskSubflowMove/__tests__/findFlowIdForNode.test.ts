import { describe, expect, it } from 'vitest';
import { findFlowIdContainingNode } from '../findFlowIdForNode';

describe('findFlowIdContainingNode', () => {
  it('returns the flow id whose nodes array contains the node id', () => {
    const flows = {
      main: { nodes: [{ id: 'n1' }, { id: 'n2' }] },
      subflow_x: { nodes: [{ id: 'sn1' }] },
    };
    expect(findFlowIdContainingNode(flows, 'sn1')).toBe('subflow_x');
    expect(findFlowIdContainingNode(flows, 'n2')).toBe('main');
  });

  it('returns null when node is missing or flows empty', () => {
    expect(findFlowIdContainingNode({}, 'n1')).toBeNull();
    expect(findFlowIdContainingNode(undefined, 'n1')).toBeNull();
    expect(findFlowIdContainingNode({ main: { nodes: [] } }, 'n1')).toBeNull();
  });
});
