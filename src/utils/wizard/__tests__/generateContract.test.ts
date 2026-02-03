// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContractForNode } from '../generateContract';
import { SemanticContractService } from '../../../services/SemanticContractService';
import { buildSemanticContract } from '../../semanticContractBuilder';
import type { TaskTreeNode } from '../../../types/taskTypes';
import type { SemanticContract } from '../../../types/semanticContract';
import type { GenerationProgress } from '../types';

vi.mock('../../../services/SemanticContractService');
vi.mock('../../semanticContractBuilder');

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
