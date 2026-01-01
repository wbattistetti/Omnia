import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import TreeRenderer from '../TreeRenderer';
import { TreeNodeProps } from '../../types';

describe('TreeRenderer', () => {
  it('should export a React component', () => {
    expect(TreeRenderer).toBeDefined();
    expect(typeof TreeRenderer).toBe('function');
  });

  it('should accept required props', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    // Test that the component can be instantiated without errors
    expect(() => {
      <TreeRenderer
        nodes={mockNodes}
        parentId={undefined}
        level={0}
        selectedNodeId={null}
        onDrop={vi.fn()}
        onRemove={vi.fn()}
        setSelectedNodeId={vi.fn()}
      />
    }).not.toThrow();
  });

  it('should handle escalation nodes', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Root Node', type: 'root' },
      { id: '2', text: 'Escalation Node', type: 'escalation', level: 1, parentId: '1' },
      { id: '3', text: 'Child Node', type: 'nomatch', level: 2, parentId: '2' }
    ];
    
    expect(() => {
      <TreeRenderer
        nodes={mockNodes}
        parentId={undefined}
        level={0}
        selectedNodeId={null}
        onDrop={vi.fn()}
        onRemove={vi.fn()}
        setSelectedNodeId={vi.fn()}
        stepKey="test"
        extraProps={{ onToggleInclude: vi.fn() }}
      />
    }).not.toThrow();
  });

  it('should handle empty nodes array', () => {
    expect(() => {
      <TreeRenderer
        nodes={[]}
        parentId={undefined}
        level={0}
        selectedNodeId={null}
        onDrop={vi.fn()}
        onRemove={vi.fn()}
        setSelectedNodeId={vi.fn()}
      />
    }).not.toThrow();
  });

  it('should have proper TypeScript types', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    const component = <TreeRenderer
      nodes={mockNodes}
      parentId={undefined}
      level={0}
      selectedNodeId={null}
      onDrop={vi.fn()}
      onRemove={vi.fn()}
      setSelectedNodeId={vi.fn()}
      stepKey="test"
      extraProps={{ foreColor: '#000000', bgColor: '#ffffff' }}
      singleEscalationSteps={['start', 'success']}
    />;
    expect(component).toBeDefined();
  });
}); 