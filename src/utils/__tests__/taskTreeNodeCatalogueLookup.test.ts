import { describe, it, expect } from 'vitest';
import type { TaskTreeNode } from '@types/taskTypes';
import { catalogueLookupTemplateId } from '../taskTreeNodeCatalogueLookup';

describe('catalogueLookupTemplateId', () => {
  it('prefers catalogTemplateId over templateId', () => {
    const node = {
      id: 'g1',
      templateId: 'graph-only',
      label: 'x',
      catalogTemplateId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    } as TaskTreeNode;
    expect(catalogueLookupTemplateId(node)).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('falls back to templateId', () => {
    const node = { id: 'n1', templateId: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'y' } as TaskTreeNode;
    expect(catalogueLookupTemplateId(node)).toBe('bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
});
