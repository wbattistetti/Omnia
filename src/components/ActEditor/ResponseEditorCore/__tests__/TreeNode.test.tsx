import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TreeNode } from '../TreeNode';

describe('TreeNode', () => {
  const mockNode = {
    id: 'test-node-1',
    text: 'Test Node',
    type: 'action',
    level: 0
  };

  it('should render node information correctly', () => {
    const mockOnRemoveNode = vi.fn();
    
    render(
      <TreeNode 
        node={mockNode}
        onRemoveNode={mockOnRemoveNode}
      />
    );
    
    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('Tipo: action | Livello: 0')).toBeInTheDocument();
  });

  it('should call onRemoveNode when trash button is clicked', () => {
    const mockOnRemoveNode = vi.fn();
    
    render(
      <TreeNode 
        node={mockNode}
        onRemoveNode={mockOnRemoveNode}
      />
    );
    
    const trashButton = screen.getByRole('button', { name: /elimina nodo/i });
    fireEvent.click(trashButton);
    
    expect(mockOnRemoveNode).toHaveBeenCalledWith('test-node-1');
  });

  it('should show node id if text is not available', () => {
    const mockOnRemoveNode = vi.fn();
    const nodeWithoutText = {
      id: 'node-without-text',
      type: 'escalation',
      level: 1
    };
    
    render(
      <TreeNode 
        node={nodeWithoutText}
        onRemoveNode={mockOnRemoveNode}
      />
    );
    
    expect(screen.getByText('node-without-text')).toBeInTheDocument();
  });
}); 