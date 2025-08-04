import { describe, it, expect } from 'vitest';
import { TreeNodeProps } from '../types';

// Funzione di filtraggio spostata in useDDTEditorComputed
function getFilteredNodes(nodes: TreeNodeProps[], selectedStep: string | null): TreeNodeProps[] {
  if (!selectedStep) return nodes;
  
  return nodes.filter((node: any) => {
    // Per step 'start' e 'success': solo azioni dirette
    if (selectedStep === 'start' || selectedStep === 'success') {
      return node.level === 0 && !node.parentId;
    }
    
    // Per altri step: mostra escalation e azioni figlie
    return node.stepType === selectedStep;
  });
}

describe('useFilteredNodes', () => {
  const mockNodes: TreeNodeProps[] = [
    { id: 'action1', text: 'Action 1', type: 'action', level: 0 },
    { id: 'escalation1', text: 'Escalation 1', type: 'escalation', stepType: 'start', level: 0 },
    { id: 'escalation2', text: 'Escalation 2', type: 'escalation', stepType: 'noMatch', level: 0 },
    { id: 'escalation3', text: 'Escalation 3', type: 'escalation', stepType: 'success', level: 0 },
    { id: 'child1', text: 'Child 1', type: 'action', parentId: 'escalation1', level: 1 },
    { id: 'child2', text: 'Child 2', type: 'action', parentId: 'escalation2', level: 1 },
    { id: 'child3', text: 'Child 3', type: 'action', parentId: 'escalation3', level: 1 },
  ];

  describe('getFilteredNodes', () => {
    it('should return all nodes when no step is selected', () => {
      const result = getFilteredNodes(mockNodes, null);
      expect(result).toEqual(mockNodes);
    });

    it('should return all nodes when step is empty string', () => {
      const result = getFilteredNodes(mockNodes, '');
      expect(result).toEqual(mockNodes);
    });

    it('should hide escalation for start step', () => {
      const result = getFilteredNodes(mockNodes, 'start');
      expect(result).toEqual([]);
    });

    it('should hide escalation for success step', () => {
      const result = getFilteredNodes(mockNodes, 'success');
      expect(result).toEqual([]);
    });

    it('should show escalation for noMatch step', () => {
      const result = getFilteredNodes(mockNodes, 'noMatch');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('escalation2');
      expect(result[1].id).toBe('child2');
    });

    it('should show escalation for noInput step', () => {
      const result = getFilteredNodes(mockNodes, 'noInput');
      expect(result).toHaveLength(0); // No escalation for noInput in mock data
    });

    it('should include child nodes of visible escalations', () => {
      const result = getFilteredNodes(mockNodes, 'noMatch');
      const escalationIds = result.filter(n => n.type === 'escalation').map(n => n.id);
      const childNodes = result.filter(n => n.type === 'action' && n.parentId);
      
      expect(escalationIds).toContain('escalation2');
      expect(childNodes).toHaveLength(1);
      expect(childNodes[0].parentId).toBe('escalation2');
    });

    it('should not include child nodes of hidden escalations', () => {
      const result = getFilteredNodes(mockNodes, 'start');
      const childNodes = result.filter(n => n.type === 'action' && n.parentId === 'escalation1');
      expect(childNodes).toHaveLength(0);
    });

    it('should handle nodes without stepType', () => {
      const nodesWithoutStepType: TreeNodeProps[] = [
        { id: 'escalation4', text: 'Escalation 4', type: 'escalation', level: 0 },
      ];
      const result = getFilteredNodes(nodesWithoutStepType, 'noMatch');
      expect(result).toHaveLength(0);
    });

    it('should handle empty nodes array', () => {
      const result = getFilteredNodes([], 'noMatch');
      expect(result).toEqual([]);
    });
  });
}); 