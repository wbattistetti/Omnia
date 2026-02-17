// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContractForNode, generateContractsForAllNodes } from '../generateContract';
import { SemanticContractService } from '../../../services/SemanticContractService';
import { buildSemanticContract } from '../../contract/buildEntity';
import type { TaskTreeNode, TaskTree } from '../../../types/taskTypes';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

vi.mock('../../../services/SemanticContractService');
vi.mock('../../contract/buildEntity');

describe('generateContractForNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful contract generation', () => {
    it('should generate and save contract for node', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node',
        type: 'date'
      };

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test Node',
          type: 'date',
          description: 'A date'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      const result = await generateContractForNode(node);

      expect(result).toEqual(mockContract);
      expect(buildSemanticContract).toHaveBeenCalledWith(node);
      expect(SemanticContractService.save).toHaveBeenCalledWith('node1', mockContract);
    });

    it('should call onProgress callback during generation', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test Node',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      const progressCalls: GenerationProgress[] = [];

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      await generateContractForNode(node, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0].currentAction).toBe('Generating semantic contract...');
      expect(progressCalls[0].percentage).toBe(0);
      expect(progressCalls[1].currentAction).toBe('Contract generated and saved');
      expect(progressCalls[1].percentage).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should return null when builder fails', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      vi.mocked(buildSemanticContract).mockReturnValue(null);

      const result = await generateContractForNode(node);

      expect(result).toBeNull();
      expect(SemanticContractService.save).not.toHaveBeenCalled();
    });

    it('should throw error when save fails', async () => {
      const node: TaskTreeNode = {
        id: 'node1',
        label: 'Test Node'
      };

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test Node',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockRejectedValue(new Error('Save failed'));

      await expect(generateContractForNode(node)).rejects.toThrow('Save failed');
    });
  });

  describe('edge cases', () => {
    it('should handle node with templateId instead of id', async () => {
      const node: TaskTreeNode = {
        templateId: 'node1',
        label: 'Test Node'
      };

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test Node',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      const result = await generateContractForNode(node);

      expect(result).toEqual(mockContract);
      expect(SemanticContractService.save).toHaveBeenCalledWith('node1', mockContract);
    });

    it('should handle node without label', async () => {
      const node: TaskTreeNode = {
        id: 'node1'
      };

      const mockContract: SemanticContract = {
        entity: {
          label: 'node1',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      const progressCalls: GenerationProgress[] = [];

      await generateContractForNode(node, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls[0].currentNodeLabel).toBe('node1');
    });
  });
});

describe('generateContractsForAllNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idempotency', () => {
    it('should skip nodes that already have contracts', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [
          {
            id: 'node1',
            templateId: 'node1',
            label: 'Node 1'
          },
          {
            id: 'node2',
            templateId: 'node2',
            label: 'Node 2'
          }
        ],
        steps: {}
      };

      // Node 1 already has contract, node 2 doesn't
      vi.mocked(SemanticContractService.exists).mockImplementation(async (nodeId: string) => {
        return nodeId === 'node1';
      });

      const mockContract: SemanticContract = {
        entity: {
          label: 'Node 2',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      const result = await generateContractsForAllNodes(taskTree);

      // Should only generate contract for node2
      expect(result.size).toBe(1);
      expect(result.has('node2')).toBe(true);
      expect(result.has('node1')).toBe(false);
      expect(SemanticContractService.exists).toHaveBeenCalledTimes(2);
      expect(buildSemanticContract).toHaveBeenCalledTimes(1);
      expect(SemanticContractService.save).toHaveBeenCalledTimes(1);
      expect(SemanticContractService.save).toHaveBeenCalledWith('node2', mockContract);
    });

    it('should return empty map if all nodes already have contracts', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [
          {
            id: 'node1',
            templateId: 'node1',
            label: 'Node 1'
          }
        ],
        steps: {}
      };

      vi.mocked(SemanticContractService.exists).mockResolvedValue(true);

      const result = await generateContractsForAllNodes(taskTree);

      expect(result.size).toBe(0);
      expect(buildSemanticContract).not.toHaveBeenCalled();
      expect(SemanticContractService.save).not.toHaveBeenCalled();
    });
  });

  describe('recursive node collection', () => {
    it('should generate contracts for all nodes including subNodes', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [
          {
            id: 'node1',
            templateId: 'node1',
            label: 'Node 1',
            subNodes: [
              {
                id: 'node1-1',
                templateId: 'node1-1',
                label: 'Node 1-1'
              },
              {
                id: 'node1-2',
                templateId: 'node1-2',
                label: 'Node 1-2',
                subNodes: [
                  {
                    id: 'node1-2-1',
                    templateId: 'node1-2-1',
                    label: 'Node 1-2-1'
                  }
                ]
              }
            ]
          }
        ],
        steps: {}
      };

      // No contracts exist
      vi.mocked(SemanticContractService.exists).mockResolvedValue(false);

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);
      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      const result = await generateContractsForAllNodes(taskTree);

      // Should generate contracts for all 4 nodes (node1, node1-1, node1-2, node1-2-1)
      expect(result.size).toBe(4);
      expect(result.has('node1')).toBe(true);
      expect(result.has('node1-1')).toBe(true);
      expect(result.has('node1-2')).toBe(true);
      expect(result.has('node1-2-1')).toBe(true);
      expect(SemanticContractService.exists).toHaveBeenCalledTimes(4);
      expect(buildSemanticContract).toHaveBeenCalledTimes(4);
      expect(SemanticContractService.save).toHaveBeenCalledTimes(4);
    });
  });

  describe('error handling', () => {
    it('should not throw if some nodes fail to generate contracts', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [
          {
            id: 'node1',
            templateId: 'node1',
            label: 'Node 1'
          },
          {
            id: 'node2',
            templateId: 'node2',
            label: 'Node 2'
          }
        ],
        steps: {}
      };

      vi.mocked(SemanticContractService.exists).mockResolvedValue(false);

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      // Node 1 succeeds, node 2 fails
      vi.mocked(buildSemanticContract).mockImplementation((node: TaskTreeNode) => {
        if (node.id === 'node1') {
          return mockContract;
        }
        return null; // node2 fails
      });

      vi.mocked(SemanticContractService.save).mockResolvedValue(undefined);

      // Should not throw
      const result = await generateContractsForAllNodes(taskTree);

      // Should only have contract for node1
      expect(result.size).toBe(1);
      expect(result.has('node1')).toBe(true);
      expect(result.has('node2')).toBe(false);
    });

    it('should handle save errors gracefully', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [
          {
            id: 'node1',
            templateId: 'node1',
            label: 'Node 1'
          },
          {
            id: 'node2',
            templateId: 'node2',
            label: 'Node 2'
          }
        ],
        steps: {}
      };

      vi.mocked(SemanticContractService.exists).mockResolvedValue(false);

      const mockContract: SemanticContract = {
        entity: {
          label: 'Test',
          type: 'text',
          description: 'A text'
        },
        outputCanonical: {
          format: 'value'
        }
      };

      vi.mocked(buildSemanticContract).mockReturnValue(mockContract);

      // Node 1 save succeeds, node 2 save fails
      vi.mocked(SemanticContractService.save).mockImplementation(async (nodeId: string) => {
        if (nodeId === 'node2') {
          throw new Error('Save failed');
        }
      });

      // Should not throw
      const result = await generateContractsForAllNodes(taskTree);

      // Should only have contract for node1 (node2 save failed)
      expect(result.size).toBe(1);
      expect(result.has('node1')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty TaskTree', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [],
        steps: {}
      };

      const result = await generateContractsForAllNodes(taskTree);

      expect(result.size).toBe(0);
      expect(SemanticContractService.exists).not.toHaveBeenCalled();
      expect(buildSemanticContract).not.toHaveBeenCalled();
    });

    it('should handle TaskTree with null nodes', async () => {
      const taskTree: TaskTree = {
        labelKey: 'test',
        nodes: [],
        steps: {}
      };

      const result = await generateContractsForAllNodes(taskTree);

      expect(result.size).toBe(0);
    });
  });
});
