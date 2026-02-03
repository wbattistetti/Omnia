// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { buildGenerationPlan } from '../buildGenerationPlan';
import type { TreeAnalysis } from '../analyzeTree';
import type { EngineProposal } from '../proposeEngines';

describe('buildGenerationPlan', () => {
  describe('generation plan with single node', () => {
    it('should generate plan for one node without contract', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex', 'llm'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex', 'llm'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const proposals: EngineProposal[] = [
        {
          nodeId: 'node1',
          engines: [
            { type: 'regex', priority: 1, enabled: true, reason: 'Default' },
            { type: 'llm', priority: 2, enabled: true, reason: 'Default' }
          ]
        }
      ];

      const plan = buildGenerationPlan(analysis, proposals);

      expect(plan.nodesToGenerate).toHaveLength(1);
      expect(plan.nodesToGenerate[0]).toEqual({
        nodeId: 'node1',
        nodeLabel: 'Test Node',
        generateContract: true,
        generateEngines: ['regex', 'llm'],
        generateEscalation: true,
        generateTests: true
      });
      expect(plan.totalSteps).toBe(5); // contract + 2 engines + escalation + tests
    });

    it('should generate plan for one node with contract but without engines', () => {
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

      const proposals: EngineProposal[] = [
        {
          nodeId: 'node1',
          engines: [
            { type: 'regex', priority: 1, enabled: true, reason: 'Default' }
          ]
        }
      ];

      const plan = buildGenerationPlan(analysis, proposals);

      expect(plan.nodesToGenerate).toHaveLength(1);
      expect(plan.nodesToGenerate[0].generateContract).toBe(false);
      expect(plan.nodesToGenerate[0].generateEngines).toEqual(['regex']);
      expect(plan.totalSteps).toBe(3); // 1 engine + escalation + tests
    });
  });

  describe('generation plan with multiple nodes', () => {
    it('should generate plan for multiple nodes', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 3,
        nodesWithoutContract: [
          {
            nodeId: 'node1',
            nodeLabel: 'Node 1',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithoutEngines: [
          {
            nodeId: 'node2',
            nodeLabel: 'Node 2',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['llm'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Node 1',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          },
          {
            nodeId: 'node2',
            nodeLabel: 'Node 2',
            hasContract: true,
            hasEngines: false,
            missingEngines: ['llm'],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          },
          {
            nodeId: 'node3',
            nodeLabel: 'Node 3',
            hasContract: true,
            hasEngines: true,
            missingEngines: [],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const proposals: EngineProposal[] = [
        {
          nodeId: 'node1',
          engines: [
            { type: 'regex', priority: 1, enabled: true, reason: 'Default' }
          ]
        },
        {
          nodeId: 'node2',
          engines: [
            { type: 'llm', priority: 1, enabled: true, reason: 'Default' }
          ]
        }
      ];

      const plan = buildGenerationPlan(analysis, proposals);

      expect(plan.nodesToGenerate).toHaveLength(2);
      expect(plan.nodesToGenerate.find(n => n.nodeId === 'node1')?.generateContract).toBe(true);
      expect(plan.nodesToGenerate.find(n => n.nodeId === 'node2')?.generateContract).toBe(false);
      expect(plan.totalSteps).toBe(7); // node1: contract + engine + escalation + tests = 4, node2: engine + escalation + tests = 3
    });
  });

  describe('user selection filtering', () => {
    it('should filter nodes based on user selection', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 3,
        nodesWithoutContract: [
          {
            nodeId: 'node1',
            nodeLabel: 'Node 1',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          },
          {
            nodeId: 'node2',
            nodeLabel: 'Node 2',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['llm'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Node 1',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          },
          {
            nodeId: 'node2',
            nodeLabel: 'Node 2',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['llm'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          },
          {
            nodeId: 'node3',
            nodeLabel: 'Node 3',
            hasContract: true,
            hasEngines: true,
            missingEngines: [],
            contractComplete: true,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const proposals: EngineProposal[] = [
        {
          nodeId: 'node1',
          engines: [
            { type: 'regex', priority: 1, enabled: true, reason: 'Default' }
          ]
        }
      ];

      const plan = buildGenerationPlan(analysis, proposals, { nodeIds: ['node1'] });

      expect(plan.nodesToGenerate).toHaveLength(1);
      expect(plan.nodesToGenerate[0].nodeId).toBe('node1');
    });
  });

  describe('edge cases', () => {
    it('should return empty plan for empty analysis', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 0,
        nodesWithoutContract: [],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: []
      };

      const proposals: EngineProposal[] = [];
      const plan = buildGenerationPlan(analysis, proposals);

      expect(plan.nodesToGenerate).toHaveLength(0);
      expect(plan.totalSteps).toBe(0);
    });

    it('should handle nodes without proposals', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const proposals: EngineProposal[] = [];
      const plan = buildGenerationPlan(analysis, proposals);

      expect(plan.nodesToGenerate).toHaveLength(1);
      expect(plan.nodesToGenerate[0].generateEngines).toEqual([]);
      expect(plan.totalSteps).toBe(3); // contract + escalation + tests (no engines)
    });

    it('should handle disabled engines in proposal', () => {
      const analysis: TreeAnalysis = {
        totalNodes: 1,
        nodesWithoutContract: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex', 'llm'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ],
        nodesWithoutEngines: [],
        nodesWithIncompleteContract: [],
        allNodes: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            hasContract: false,
            hasEngines: false,
            missingEngines: ['regex', 'llm'],
            contractComplete: false,
            isComposite: false,
            subNodesCount: 0
          }
        ]
      };

      const proposals: EngineProposal[] = [
        {
          nodeId: 'node1',
          engines: [
            { type: 'regex', priority: 1, enabled: true, reason: 'Default' },
            { type: 'llm', priority: 2, enabled: false, reason: 'Disabled' }
          ]
        }
      ];

      const plan = buildGenerationPlan(analysis, proposals);

      expect(plan.nodesToGenerate[0].generateEngines).toEqual(['regex']);
      expect(plan.totalSteps).toBe(4); // contract + 1 engine + escalation + tests
    });
  });
});
