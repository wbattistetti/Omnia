import { describe, it, expect } from 'vitest';
import { estraiNodiDaDDT, removeNodePure } from '../treeFactories';
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

describe('treeFactories', () => {
  describe('estraiNodiDaDDT', () => {
    it('should extract direct actions for start step (new structure)', () => {
      const ddt = {
        id: 'test-ddt',
        steps: [
          {
            type: 'start',
            escalations: [
              {
                escalationId: 'esc1',
                actions: [
                  { actionInstanceId: 'action1', parameters: [{ value: 'key1' }] }
                ]
              }
            ]
          }
        ]
      };
      const translations = { key1: 'Ho capito!' };
      const result = estraiNodiDaDDT(ddt, translations, 'it');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'esc1',
        text: 'recovery',
        type: 'escalation',
        stepType: 'start',
        level: 0,
        included: true
      });
      expect(result[1]).toEqual({
        id: 'action1',
        text: 'Ho capito!',
        type: 'start',
        level: 1,
        parentId: 'esc1'
      });
    });

    it('should extract direct actions for success step (new structure)', () => {
      const ddt = {
        id: 'test-ddt',
        steps: [
          {
            type: 'success',
            escalations: [
              {
                escalationId: 'esc1',
                actions: [
                  { actionInstanceId: 'action1', parameters: [{ value: 'key1' }] }
                ]
              }
            ]
          }
        ]
      };
      const translations = { key1: 'Dato acquisito con successo!' };
      const result = estraiNodiDaDDT(ddt, translations, 'it');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'esc1',
        text: 'recovery',
        type: 'escalation',
        stepType: 'success',
        level: 0,
        included: true
      });
      expect(result[1]).toEqual({
        id: 'action1',
        text: 'Dato acquisito con successo!',
        type: 'success',
        level: 1,
        parentId: 'esc1'
      });
    });

    it('should extract escalations and child actions for noMatch step (new structure)', () => {
      const ddt = {
        id: 'test-ddt',
        steps: [
          {
            type: 'noMatch',
            escalations: [
              {
                escalationId: 'esc1',
                actions: [
                  { actionInstanceId: 'action1', parameters: [{ value: 'key1' }] }
                ]
              }
            ]
          }
        ]
      };
      const translations = { key1: 'Non ho capito, puoi ripetere?' };
      const result = estraiNodiDaDDT(ddt, translations, 'it');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'esc1',
        text: 'recovery',
        type: 'escalation',
        stepType: 'noMatch',
        level: 0,
        included: true
      });
      expect(result[1]).toEqual({
        id: 'action1',
        text: 'Non ho capito, puoi ripetere?',
        type: 'noMatch',
        level: 1,
        parentId: 'esc1'
      });
    });

    it('should handle empty translations gracefully', () => {
      const ddt = {
        id: 'test-ddt',
        steps: [
          {
            type: 'start',
            escalations: [
              {
                escalationId: 'esc1',
                actions: [
                  { actionInstanceId: 'action1', parameters: [{ value: 'key1' }] }
                ]
              }
            ]
          }
        ]
      };
      const translations = {};
      const result = estraiNodiDaDDT(ddt, translations, 'it');
      
      expect(result).toHaveLength(2);
      expect(result[1].text).toBe('');
    });

    it('should return empty array for invalid DDT', () => {
      const result = estraiNodiDaDDT(null, {}, 'it');
      expect(result).toEqual([]);
    });
  });

  describe('getFilteredNodes', () => {
    const mockNodes: TreeNodeProps[] = [
      { id: 'action1', text: 'Action 1', type: 'action', stepType: 'start', level: 0 },
      { id: 'action2', text: 'Action 2', type: 'action', stepType: 'success', level: 0 },
      { id: 'esc1', text: 'recovery', type: 'escalation', stepType: 'noMatch', level: 0, included: true },
      { id: 'action3', text: 'Action 3', type: 'action', stepType: 'noMatch', level: 1, parentId: 'esc1' }
    ];

    it('should return empty array when no step is selected', () => {
      const result = getFilteredNodes(mockNodes, null);
      expect(result).toEqual([]);
    });

    it('should return direct actions for start step', () => {
      const result = getFilteredNodes(mockNodes, 'start');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('action1');
    });

    it('should return direct actions for success step', () => {
      const result = getFilteredNodes(mockNodes, 'success');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('action2');
    });

    it('should return escalations and child actions for noMatch step', () => {
      const result = getFilteredNodes(mockNodes, 'noMatch');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('esc1');
      expect(result[1].id).toBe('action3');
    });

    it('should filter correctly when multiple nodes exist', () => {
      const multipleNodes = [
        { id: 'action1', text: 'Action 1', type: 'action', stepType: 'start', level: 0 },
        { id: 'action2', text: 'Action 2', type: 'action', stepType: 'start', level: 0 },
        { id: 'esc1', text: 'recovery', type: 'escalation', stepType: 'noMatch', level: 0, included: true },
        { id: 'action3', text: 'Action 3', type: 'action', stepType: 'noMatch', level: 1, parentId: 'esc1' }
      ];
      const result = getFilteredNodes(multipleNodes, 'start');
      expect(result).toHaveLength(2);
      expect(result.every(n => n.level === 0 && !n.parentId)).toBe(true);
    });

    it('should not include escalation children for start/success', () => {
      const result = getFilteredNodes(mockNodes, 'start');
      expect(result.every(n => n.level === 0 && !n.parentId)).toBe(true);
    });
  });

  describe('removeNodePure', () => {
    it('should remove escalation and all its children when removeChildren is true', () => {
      const nodes: TreeNodeProps[] = [
        { id: 'action1', text: 'Action 1', type: 'start', level: 0 },
        { id: 'esc1', text: 'recovery', type: 'escalation', level: 0, included: true },
        { id: 'action2', text: 'Action 2', type: 'noMatch', level: 1, parentId: 'esc1' },
        { id: 'action3', text: 'Action 3', type: 'noMatch', level: 1, parentId: 'esc1' },
        { id: 'action4', text: 'Action 4', type: 'start', level: 0 }
      ];
      
      const result = removeNodePure(nodes, 'esc1', true);
      
      expect(result).toHaveLength(2);
      expect(result.map((n: TreeNodeProps) => n.id)).toEqual(['action1', 'action4']);
      expect(result.some((n: TreeNodeProps) => n.id === 'esc1')).toBe(false);
      expect(result.some((n: TreeNodeProps) => n.id === 'action2')).toBe(false);
      expect(result.some((n: TreeNodeProps) => n.id === 'action3')).toBe(false);
    });

    it('should remove only the specific node when removeChildren is false', () => {
      const nodes: TreeNodeProps[] = [
        { id: 'action1', text: 'Action 1', type: 'start', level: 0 },
        { id: 'esc1', text: 'recovery', type: 'escalation', level: 0, included: true },
        { id: 'action2', text: 'Action 2', type: 'noMatch', level: 1, parentId: 'esc1' },
        { id: 'action3', text: 'Action 3', type: 'noMatch', level: 1, parentId: 'esc1' }
      ];
      
      const result = removeNodePure(nodes, 'action2', false);
      
      expect(result).toHaveLength(3);
      expect(result.map((n: TreeNodeProps) => n.id)).toEqual(['action1', 'esc1', 'action3']);
      expect(result.some((n: TreeNodeProps) => n.id === 'action2')).toBe(false);
    });

    it('should handle nested escalation removal correctly', () => {
      const nodes: TreeNodeProps[] = [
        { id: 'esc1', text: 'recovery', type: 'escalation', level: 0, included: true },
        { id: 'action1', text: 'Action 1', type: 'noMatch', level: 1, parentId: 'esc1' },
        { id: 'esc2', text: 'recovery', type: 'escalation', level: 1, parentId: 'esc1' },
        { id: 'action2', text: 'Action 2', type: 'noMatch', level: 2, parentId: 'esc2' },
        { id: 'action3', text: 'Action 3', type: 'noMatch', level: 2, parentId: 'esc2' }
      ];
      
      const result = removeNodePure(nodes, 'esc1', true);
      
      expect(result).toHaveLength(0);
      expect(result.some((n: TreeNodeProps) => n.id === 'esc1')).toBe(false);
      expect(result.some((n: TreeNodeProps) => n.id === 'esc2')).toBe(false);
      expect(result.some((n: TreeNodeProps) => n.id === 'action1')).toBe(false);
      expect(result.some((n: TreeNodeProps) => n.id === 'action2')).toBe(false);
      expect(result.some((n: TreeNodeProps) => n.id === 'action3')).toBe(false);
    });
  });
}); 