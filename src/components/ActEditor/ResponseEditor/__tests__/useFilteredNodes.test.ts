import { describe, it, expect } from 'vitest';
import { TreeNodeProps } from '../types';

// Funzione di filtraggio che riflette la logica attuale
function getFilteredNodes(nodes: TreeNodeProps[], selectedStep: string | null): TreeNodeProps[] {
  if (!selectedStep) return [];
  
  // Per step 'start' e 'success': solo azioni dirette (escludi escalation e figli)
  if (selectedStep === 'start' || selectedStep === 'success') {
    return nodes.filter(
      n => n.stepType === selectedStep && n.type !== 'escalation' && !n.parentId
    );
  } else {
    // Per altri step: mostra escalation, azioni dirette e azioni figlie
    const escalationNodes = nodes.filter(
      n => n.type === 'escalation' && n.stepType === selectedStep
    );
    const escalationIds = escalationNodes.map(n => n.id);
    const childNodes = nodes.filter(
      n => n.parentId && escalationIds.includes(n.parentId)
    );
    const directActions = nodes.filter(
      n => n.stepType === selectedStep && n.type !== 'escalation' && !n.parentId
    );
    return [...escalationNodes, ...directActions, ...childNodes];
  }
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
    it('should return empty array when no step is selected', () => {
      const result = getFilteredNodes(mockNodes, null);
      expect(result).toEqual([]);
    });

    it('should return empty array when step is empty string', () => {
      const result = getFilteredNodes(mockNodes, '');
      expect(result).toEqual([]);
    });

    it('should show only direct actions for start step', () => {
      const result = getFilteredNodes(mockNodes, 'start');
      expect(result).toHaveLength(0); // No direct actions for start in mock data
    });

    it('should show only direct actions for success step', () => {
      const result = getFilteredNodes(mockNodes, 'success');
      expect(result).toHaveLength(0); // No direct actions for success in mock data
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