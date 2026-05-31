import { describe, expect, it } from 'vitest';
import { groupDestinationsByBackend, buildParameterDestinationCatalog } from '../parameterDestinationTree';
import {
  buildSlotMappingCollapsibleTree,
  collectBranchIds,
} from '../slotMappingMenuTree';

describe('slotMappingMenuTree collapsible', () => {
  it('builds nested branches not flat picks at root', () => {
    const catalog = buildParameterDestinationCatalog(
      [
        {
          backendTaskId: 'bk1',
          toolName: 'next_window',
          leaves: [
            {
              path: 'constraints.horizon.end',
              type: 'string',
              semanticRole: 'horizon_end',
            },
          ],
        },
      ],
      [
        {
          backendTaskId: 'bk1',
          toolName: 'next_window',
          leaves: [{ path: 'slots[].date', type: 'string', suggestedSlotId: 'data' }],
        },
      ]
    );
    const { backends } = groupDestinationsByBackend(catalog);
    const tree = buildSlotMappingCollapsibleTree('next_window', backends[0]!, '');
    expect(tree).toHaveLength(1);
    expect(tree[0]?.kind).toBe('branch');
    if (tree[0]?.kind === 'branch') {
      expect(tree[0].label).toBe('next_window');
      expect(tree[0].children.some((c) => c.kind === 'branch' && c.label === 'Inputs')).toBe(true);
      expect(tree[0].children.some((c) => c.kind === 'branch' && c.label === 'Outputs')).toBe(true);
    }
    const ids = collectBranchIds(tree);
    expect(ids).toContain('tool/bk1');
    expect(ids).not.toContain(tree[0]?.kind === 'branch' ? '' : 'x');
  });
});
