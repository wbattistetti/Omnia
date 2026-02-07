import { describe, it, expect } from 'vitest';
import {
  defaultNodes,
  ESCALATION_CONSTANTS,
  isEscalationNode,
  getEscalationChildren,
  calculateEscalationLabel,
  isSingleEscalation,
  isDropOutsideNodes,
  calculateDropPosition
} from '@responseEditor/TreeView/treeViewUtils';
import { TreeNodeProps } from '@responseEditor/types';

describe('treeViewUtils', () => {
  describe('defaultNodes', () => {
    it('should have the correct structure', () => {
      expect(defaultNodes).toHaveLength(3);
      expect(defaultNodes[0]).toHaveProperty('id', '1');
      expect(defaultNodes[0]).toHaveProperty('type', 'root');
      expect(defaultNodes[1]).toHaveProperty('type', 'nomatch');
      expect(defaultNodes[2]).toHaveProperty('type', 'noinput');
    });
  });

  describe('ESCALATION_CONSTANTS', () => {
    it('should have the correct values', () => {
      expect(ESCALATION_CONSTANTS.HEADER_HEIGHT).toBe(40);
      expect(ESCALATION_CONSTANTS.PADDING).toBe(8);
      expect(ESCALATION_CONSTANTS.ACTION_HEIGHT).toBe(32);
      expect(ESCALATION_CONSTANTS.DROP_TOLERANCE).toBe(16);
    });
  });

  describe('isEscalationNode', () => {
    it('should return true for escalation nodes', () => {
      const escalationNode: TreeNodeProps = { id: '1', type: 'escalation', text: 'Test' };
      expect(isEscalationNode(escalationNode)).toBe(true);
    });

    it('should return false for non-escalation nodes', () => {
      const rootNode: TreeNodeProps = { id: '1', type: 'root', text: 'Test' };
      const nomatchNode: TreeNodeProps = { id: '2', type: 'nomatch', text: 'Test' };

      expect(isEscalationNode(rootNode)).toBe(false);
      expect(isEscalationNode(nomatchNode)).toBe(false);
    });
  });

  describe('getEscalationChildren', () => {
    it('should return children with incremented level', () => {
      const nodes: TreeNodeProps[] = [
        { id: '1', type: 'escalation', text: 'Parent' },
        { id: '2', type: 'nomatch', text: 'Child 1', parentId: '1', level: 1 },
        { id: '3', type: 'noinput', text: 'Child 2', parentId: '1', level: 1 }
      ];

      const children = getEscalationChildren(nodes, '1', 1);

      expect(children).toHaveLength(2);
      expect(children[0]).toHaveProperty('level', 2);
      expect(children[1]).toHaveProperty('level', 2);
    });

    it('should return empty array for non-existent parent', () => {
      const nodes: TreeNodeProps[] = [
        { id: '1', type: 'root', text: 'Test' }
      ];

      const children = getEscalationChildren(nodes, '999', 0);
      expect(children).toHaveLength(0);
    });
  });

  describe('calculateEscalationLabel', () => {
    it('should calculate correct label for escalation nodes', () => {
      const escalationNode: TreeNodeProps = { id: '1', type: 'escalation', text: 'Test' };
      const siblings: TreeNodeProps[] = [
        { id: '1', type: 'escalation', text: 'First' },
        { id: '2', type: 'escalation', text: 'Second' },
        { id: '3', type: 'root', text: 'Other' }
      ];

      const label = calculateEscalationLabel(escalationNode, siblings);
      expect(label).toBe('1° recovery');
    });

    it('should return undefined for non-escalation nodes', () => {
      const rootNode: TreeNodeProps = { id: '1', type: 'root', text: 'Test' };
      const siblings: TreeNodeProps[] = [rootNode];

      const label = calculateEscalationLabel(rootNode, siblings);
      expect(label).toBeUndefined();
    });
  });

  describe('isSingleEscalation', () => {
    it('should return true for single escalation in single-escalation step', () => {
      const escalationNode: TreeNodeProps = { id: '1', type: 'escalation', text: 'Test' };
      const siblings: TreeNodeProps[] = [escalationNode];

      const result = isSingleEscalation(escalationNode, siblings, 'start');
      expect(result).toBe(true);
    });

    it('should return false for multiple escalations', () => {
      const escalationNode: TreeNodeProps = { id: '1', type: 'escalation', text: 'Test' };
      const siblings: TreeNodeProps[] = [
        escalationNode,
        { id: '2', type: 'escalation', text: 'Another' }
      ];

      const result = isSingleEscalation(escalationNode, siblings, 'start');
      expect(result).toBe(false);
    });

    it('should return false for non-single-escalation steps', () => {
      const escalationNode: TreeNodeProps = { id: '1', type: 'escalation', text: 'Test' };
      const siblings: TreeNodeProps[] = [escalationNode];

      const result = isSingleEscalation(escalationNode, siblings, 'nomatch');
      expect(result).toBe(false);
    });
  });

  describe('isDropOutsideNodes', () => {
    it('should return true when drop is above nodes', () => {
      const result = isDropOutsideNodes(50, 100, 200);
      expect(result).toBe(true);
    });

    it('should return true when drop is below nodes', () => {
      const result = isDropOutsideNodes(250, 100, 200);
      expect(result).toBe(true);
    });

    it('should return false when drop is within nodes', () => {
      const result = isDropOutsideNodes(150, 100, 200);
      expect(result).toBe(false);
    });

    it('should respect tolerance', () => {
      const result = isDropOutsideNodes(83, 100, 200, 16); // 100 - 16 = 84, so 83 is outside
      expect(result).toBe(true);
    });
  });

  describe('calculateDropPosition', () => {
    it('should return before when above center', () => {
      // Mock DOM element
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 100,
          height: 50
        })
      } as HTMLElement;

      const mockContainerRect = {
        top: 0
      } as DOMRect;

      const result = calculateDropPosition(110, mockElement, mockContainerRect);
      expect(result).toBe('before');
    });

    it('should return after when below center', () => {
      // Mock DOM element
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 100,
          height: 50
        })
      } as HTMLElement;

      const mockContainerRect = {
        top: 0
      } as DOMRect;

      const result = calculateDropPosition(140, mockElement, mockContainerRect);
      expect(result).toBe('after');
    });
  });
});