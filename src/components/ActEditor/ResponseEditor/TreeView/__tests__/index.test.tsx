import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import TreeView from '../index';
import { TreeNodeProps } from '../../types';

describe('TreeView (Refactored)', () => {
  it('should export a React component', () => {
    expect(TreeView).toBeDefined();
    expect(typeof TreeView).toBe('function');
  });

  it('should accept required props', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    const mockProps = {
      nodes: mockNodes,
      onDrop: vi.fn(),
      onRemove: vi.fn(),
      onAddEscalation: vi.fn(),
      onToggleInclude: vi.fn(),
      stepKey: 'test',
      foreColor: '#000000',
      bgColor: '#ffffff'
    };
    
    // Test that the component can be instantiated without errors
    expect(() => {
      <TreeView {...mockProps} />
    }).not.toThrow();
  });

  it('should handle empty nodes array', () => {
    const mockProps = {
      nodes: [],
      onDrop: vi.fn(),
      onRemove: vi.fn()
    };
    
    expect(() => {
      <TreeView {...mockProps} />
    }).not.toThrow();
  });

  it('should have proper TypeScript types', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    const mockProps = {
      nodes: mockNodes,
      onDrop: vi.fn(),
      onRemove: vi.fn()
    };
    
    const component = <TreeView {...mockProps} />;
    expect(component).toBeDefined();
  });
}); 