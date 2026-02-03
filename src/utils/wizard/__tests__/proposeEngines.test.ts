// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { proposeEngines } from '../proposeEngines';
import { EngineEscalationService } from '../../../services/EngineEscalationService';
import type { TreeAnalysis } from '../analyzeTree';
import type { TaskTree, TaskTreeNode } from '../../../types/taskTypes';
import type { EngineEscalation } from '../../../types/semanticContract';

vi.mock('../../../services/EngineEscalationService');

describe('proposeEngines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('proposal for simple node', () => {
    it('should propose engines for node without engines', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [],
        nodesWithoutEngines: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex', 'llm'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex', 'llm'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'node1',
            label: 'Test Node',
            type: 'date'
          } as TaskTreeNode
        ]
      };

      const mockEscalation: EngineEscalation = {
        nodeId: 'node1',
        engines: [
          { type: 'regex', priority: 1, enabled: true },
          { type: 'llm', priority: 2, enabled: true }
        ]
      };

      vi.mocked(EngineEscalationService.getDefaultEscalation).mockReturnValue(mockEscalation);

      const proposals = proposeEngines(analysis, taskTree);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].nodeId).toBe('node1');
      expect(proposals[0].engines).toHaveLength(2);
      expect(proposals[0].engines[0].type).toBe('regex');
      expect(proposals[0].engines[0].reason).toContain('date');
      expect(EngineEscalationService.getDefaultEscalation).toHaveBeenCalledWith('node1', 'date');
    });
  });

  describe('proposal for composite node', () => {
    it('should propose engines for composite node', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [],
        nodesWithoutEngines: [
          {
            nodeId: 'node1',
            nodeLabel: 'Date of Birth',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex', 'rule_based'],
            contractComplete: true,
            isComposite: true,
            subNodesCount: 3
          }
        ],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Date of Birth',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex', 'rule_based'],
            contractComplete: true,
            isComposite: true,
            subNodesCount: 3
          }
        ]
      };

      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'node1',
            label: 'Date of Birth',
            type: 'date',
            subNodes: [
              { id: 'day', label: 'Day' } as TaskTreeNode,
              { id: 'month', label: 'Month' } as TaskTreeNode,
              { id: 'year', label: 'Year' } as TaskTreeNode
            ]
          } as TaskTreeNode
        ]
      };

      const mockEscalation: EngineEscalation = {
        nodeId: 'node1',
        engines: [
          { type: 'regex', priority: 1, enabled: true },
          { type: 'rule_based', priority: 2, enabled: true }
        ]
      };

      vi.mocked(EngineEscalationService.getDefaultEscalation).mockReturnValue(mockEscalation);

      const proposals = proposeEngines(analysis, taskTree);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].engines).toHaveLength(2);
    });
  });

  describe('fallback escalation', () => {
    it('should use generic type when node type is missing', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [],
        nodesWithoutEngines: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'node1',
            label: 'Test Node'
            // No type property
          } as TaskTreeNode
        ]
      };

      const mockEscalation: EngineEscalation = {
        nodeId: 'node1',
        engines: [
          { type: 'regex', priority: 1, enabled: true }
        ]
      };

      vi.mocked(EngineEscalationService.getDefaultEscalation).mockReturnValue(mockEscalation);

      const proposals = proposeEngines(analysis, taskTree);

      expect(proposals).toHaveLength(1);
      expect(EngineEscalationService.getDefaultEscalation).toHaveBeenCalledWith('node1', 'generic');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for null task tree', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: true,
            missingEngines: [],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const proposals = proposeEngines(analysis, null);

      expect(proposals).toEqual([]);
    });

    it('should skip nodes that already have engines', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 2,
        nodesWithoutContract: [],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Node 1',
            hasContract: true,
            hasEngines: true, // Already has engines
            missingEngines: [],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          },
          {
            nodeId: 'node2',
            nodeLabel: 'Node 2',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Node 1', type: 'text' } as TaskTreeNode,
          { id: 'node2', label: 'Node 2', type: 'text' } as TaskTreeNode
        ]
      };

      const mockEscalation: EngineEscalation = {
        nodeId: 'node2',
        engines: [
          { type: 'regex', priority: 1, enabled: true }
        ]
      };

      vi.mocked(EngineEscalationService.getDefaultEscalation).mockReturnValue(mockEscalation);

      const proposals = proposeEngines(analysis, taskTree);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].nodeId).toBe('node2');
      expect(EngineEscalationService.getDefaultEscalation).toHaveBeenCalledTimes(1);
    });

    it('should handle node not found in tree', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [],
        nodesWithoutEngines: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node2', label: 'Other Node' } as TaskTreeNode
        ]
      };

      const proposals = proposeEngines(analysis, taskTree);

      expect(proposals).toHaveLength(0);
      expect(EngineEscalationService.getDefaultEscalation).not.toHaveBeenCalled();
    });
  });
});
