import { describe, it, expect } from 'vitest';
import { TreeNodeProps } from '../types';

// Funzione di filtraggio estratta da ResponseEditor.tsx per il test
function getFilteredNodesForStep(nodes: TreeNodeProps[], selectedStep: string | null): TreeNodeProps[] {
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

describe('ResponseEditor Filtering Logic', () => {
  const mockNodes: TreeNodeProps[] = [
    // Azioni dirette per start
    { 
      id: 'start_action1', 
      text: 'Chiedo il dato', 
      type: 'action', 
      stepType: 'start', 
      level: 0,
      parentId: undefined
    },
    { 
      id: 'start_action2', 
      text: 'Conferma dato', 
      type: 'action', 
      stepType: 'start', 
      level: 0,
      parentId: undefined
    },
    // Escalation per start (dovrebbe essere nascosta)
    { 
      id: 'start_escalation1', 
      text: '1° recovery', 
      type: 'escalation', 
      stepType: 'start', 
      level: 0,
      parentId: undefined
    },
    // Azioni figlie dell'escalation start (dovrebbero essere nascoste)
    { 
      id: 'start_escalation_child1', 
      text: 'Riprova', 
      type: 'action', 
      stepType: 'start', 
      level: 1,
      parentId: 'start_escalation1'
    },
    
    // Azioni dirette per success
    { 
      id: 'success_action1', 
      text: 'Ho capito!', 
      type: 'action', 
      stepType: 'success', 
      level: 0,
      parentId: undefined
    },
    // Escalation per success (dovrebbe essere nascosta)
    { 
      id: 'success_escalation1', 
      text: '1° recovery', 
      type: 'escalation', 
      stepType: 'success', 
      level: 0,
      parentId: undefined
    },
    
    // Azioni dirette per noMatch
    { 
      id: 'noMatch_action1', 
      text: 'Non capisco', 
      type: 'action', 
      stepType: 'noMatch', 
      level: 0,
      parentId: undefined
    },
    // Escalation per noMatch (dovrebbe essere visibile)
    { 
      id: 'noMatch_escalation1', 
      text: '1° recovery', 
      type: 'escalation', 
      stepType: 'noMatch', 
      level: 0,
      parentId: undefined
    },
    // Azioni figlie dell'escalation noMatch (dovrebbero essere visibili)
    { 
      id: 'noMatch_escalation_child1', 
      text: 'Riprova', 
      type: 'action', 
      stepType: 'noMatch', 
      level: 1,
      parentId: 'noMatch_escalation1'
    },
    { 
      id: 'noMatch_escalation_child2', 
      text: 'Chiama operatore', 
      type: 'action', 
      stepType: 'noMatch', 
      level: 1,
      parentId: 'noMatch_escalation1'
    }
  ];

  describe('Start Step Filtering', () => {
    it('should show only direct actions for start step, excluding escalations', () => {
      const result = getFilteredNodesForStep(mockNodes, 'start');
      
      // Dovrebbe mostrare solo le azioni dirette
      expect(result).toHaveLength(2);
      expect(result.map(n => n.id)).toEqual(['start_action1', 'start_action2']);
      
      // Non dovrebbe includere escalation
      expect(result.some(n => n.type === 'escalation')).toBe(false);
      expect(result.some(n => n.id === 'start_escalation1')).toBe(false);
      
      // Non dovrebbe includere figli delle escalation
      expect(result.some(n => n.parentId === 'start_escalation1')).toBe(false);
    });

    it('should include actions with correct stepType for start', () => {
      const result = getFilteredNodesForStep(mockNodes, 'start');
      
      result.forEach(node => {
        expect(node.stepType).toBe('start');
        expect(node.type).not.toBe('escalation');
      });
    });
  });

  describe('Success Step Filtering', () => {
    it('should show only direct actions for success step, excluding escalations', () => {
      const result = getFilteredNodesForStep(mockNodes, 'success');
      
      // Dovrebbe mostrare solo le azioni dirette
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('success_action1');
      
      // Non dovrebbe includere escalation
      expect(result.some(n => n.type === 'escalation')).toBe(false);
      expect(result.some(n => n.id === 'success_escalation1')).toBe(false);
    });

    it('should include actions with correct stepType for success', () => {
      const result = getFilteredNodesForStep(mockNodes, 'success');
      
      result.forEach(node => {
        expect(node.stepType).toBe('success');
        expect(node.type).not.toBe('escalation');
      });
    });
  });

  describe('NoMatch Step Filtering', () => {
    it('should show escalations and their children for noMatch step', () => {
      const result = getFilteredNodesForStep(mockNodes, 'noMatch');
      
      // Dovrebbe includere escalation e azioni dirette
      expect(result).toHaveLength(4);
      
      // Dovrebbe includere l'escalation
      expect(result.some(n => n.id === 'noMatch_escalation1')).toBe(true);
      
      // Dovrebbe includere le azioni dirette
      expect(result.some(n => n.id === 'noMatch_action1')).toBe(true);
      
      // Dovrebbe includere i figli dell'escalation
      expect(result.some(n => n.id === 'noMatch_escalation_child1')).toBe(true);
      expect(result.some(n => n.id === 'noMatch_escalation_child2')).toBe(true);
    });

    it('should include escalation with correct stepType for noMatch', () => {
      const result = getFilteredNodesForStep(mockNodes, 'noMatch');
      const escalation = result.find(n => n.type === 'escalation');
      
      expect(escalation).toBeDefined();
      expect(escalation?.stepType).toBe('noMatch');
    });

    it('should include child nodes of visible escalations', () => {
      const result = getFilteredNodesForStep(mockNodes, 'noMatch');
      const childNodes = result.filter(n => n.parentId === 'noMatch_escalation1');
      
      expect(childNodes).toHaveLength(2);
      expect(childNodes.map(n => n.id)).toEqual(['noMatch_escalation_child1', 'noMatch_escalation_child2']);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty array when no step is selected', () => {
      const result = getFilteredNodesForStep(mockNodes, null);
      expect(result).toEqual([]);
    });

    it('should return empty array for unknown step', () => {
      const result = getFilteredNodesForStep(mockNodes, 'unknown');
      expect(result).toEqual([]);
    });

    it('should handle empty nodes array', () => {
      const result = getFilteredNodesForStep([], 'start');
      expect(result).toEqual([]);
    });

    it('should handle nodes without stepType', () => {
      const nodesWithoutStepType: TreeNodeProps[] = [
        { id: 'node1', text: 'Node 1', type: 'action', level: 0 }
      ];
      const result = getFilteredNodesForStep(nodesWithoutStepType, 'start');
      expect(result).toEqual([]);
    });
  });

  describe('Integration Test - Complete Scenario', () => {
    it('should correctly filter all step types in sequence', () => {
      // Test start step
      const startResult = getFilteredNodesForStep(mockNodes, 'start');
      expect(startResult.length).toBe(2);
      expect(startResult.every(n => n.stepType === 'start' && n.type !== 'escalation')).toBe(true);
      
      // Test success step
      const successResult = getFilteredNodesForStep(mockNodes, 'success');
      expect(successResult.length).toBe(1);
      expect(successResult.every(n => n.stepType === 'success' && n.type !== 'escalation')).toBe(true);
      
      // Test noMatch step
      const noMatchResult = getFilteredNodesForStep(mockNodes, 'noMatch');
      expect(noMatchResult.length).toBe(4);
      expect(noMatchResult.some(n => n.type === 'escalation')).toBe(true);
      expect(noMatchResult.some(n => n.type === 'action' && !n.parentId)).toBe(true);
    });
  });
}); 