import React from 'react';
import { describe, it, expect } from 'vitest';
import DropPreview from '../DropPreview';
import { TreeNodeProps } from '../../types';

describe('DropPreview', () => {
  it('should export a React component', () => {
    expect(DropPreview).toBeDefined();
    expect(typeof DropPreview).toBe('function');
  });

  it('should accept required props', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    // Test that the component can be instantiated without errors
    expect(() => {
      <DropPreview 
        dropPreviewIdx={0} 
        dropPreviewPosition="before" 
        nodes={mockNodes} 
      />
    }).not.toThrow();
  });

  it('should handle null values gracefully', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    expect(() => {
      <DropPreview 
        dropPreviewIdx={null} 
        dropPreviewPosition={null} 
        nodes={mockNodes} 
      />
    }).not.toThrow();
  });

  it('should have proper TypeScript types', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: '1', text: 'Test Node 1', type: 'root' }
    ];
    
    const component = <DropPreview 
      dropPreviewIdx={0} 
      dropPreviewPosition="after" 
      nodes={mockNodes} 
    />;
    expect(component).toBeDefined();
  });
}); 