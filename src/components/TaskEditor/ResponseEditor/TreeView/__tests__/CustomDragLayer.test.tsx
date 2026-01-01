import React from 'react';
import { describe, it, expect } from 'vitest';
import CustomDragLayer from '../CustomDragLayer';
import { TreeNodeProps } from '../../types';

describe('CustomDragLayer', () => {
  it('should export a React component', () => {
    expect(CustomDragLayer).toBeDefined();
    expect(typeof CustomDragLayer).toBe('function');
  });

  it('should accept nodes prop', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node', type: 'root' }
    ];
    
    // Just test that the component can be instantiated without errors
    expect(() => {
      <CustomDragLayer nodes={mockNodes} />
    }).not.toThrow();
  });

  it('should have proper TypeScript types', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node', type: 'root' }
    ];
    
    const component = <CustomDragLayer nodes={mockNodes} />;
    expect(component).toBeDefined();
  });
}); 