// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGenerationPlan } from '../executeGenerationPlan';
import { generateContractForNode } from '../generateContract';
import { generateEngineForNode } from '../generateEngines';
import { generateTestExamplesForNode } from '../generateTestExamples';
import { SemanticContractService } from '../../../services/SemanticContractService';
import { EngineEscalationService } from '../../../services/EngineEscalationService';
import type { TaskTree, TaskTreeNode } from '../../../types/taskTypes';
import type { SemanticContract, EngineConfig, EngineEscalation } from '../../../types/semanticContract';
import type { GenerationPlan } from '../buildGenerationPlan';
import type { GenerationProgress } from '../types';

vi.mock('../generateContract');
vi.mock('../generateEngines');
vi.mock('../generateTestExamples');
vi.mock('../../../services/SemanticContractService');
vi.mock('../../../services/EngineEscalationService');

describe('executeGenerationPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('complete pipeline execution for single node', () => {
    it('should execute full pipeline: contract + engines + escalation + tests', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: true,
            generateEngines: ['regex', 'llm'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 5
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

      const mockRegexEngine: EngineConfig = {
        type: 'regex',
        config: { regex: '\\d{2}/\\d{2}/\\d{4}' },
        version: 1,
        generatedAt: new Date(),
        generatedBy: 'ai'
      };

      const mockLLMEngine: EngineConfig = {
        type: 'llm',
        config: { llmPrompt: 'Extract date' },
        version: 1,
        generatedAt: new Date(),
        generatedBy: 'ai'
      };

      vi.mocked(generateContractForNode).mockResolvedValue(mockContract);
      vi.mocked(generateEngineForNode)
        .mockResolvedValueOnce(mockRegexEngine)
        .mockResolvedValueOnce(mockLLMEngine);
      vi.mocked(generateTestExamplesForNode).mockResolvedValue(['example1', 'example2']);
      vi.mocked(EngineEscalationService.save).mockResolvedValue(undefined);

      const results = await executeGenerationPlan(plan, taskTree);

      expect(results.size).toBe(1);
      const result = results.get('node1');
      expect(result?.success).toBe(true);
      expect(result?.contract).toEqual(mockContract);
      expect(result?.engines?.size).toBe(2);
      expect(result?.engines?.get('regex')).toEqual(mockRegexEngine);
      expect(result?.engines?.get('llm')).toEqual(mockLLMEngine);
      expect(result?.escalation).toBeDefined();
      expect(result?.testExamples).toEqual(['example1', 'example2']);
    });

    it('should load existing contract when generateContract is false', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: false,
            generateEngines: ['regex'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 4
      };

      const taskTree: TaskTree = {
        nodes: [
          {
            id: 'node1',
            label: 'Test Node'
          } as TaskTreeNode
        ]
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

      const mockEngine: EngineConfig = {
        type: 'regex',
        config: { regex: '\\d+' },
        version: 1,
        generatedAt: new Date(),
        generatedBy: 'ai'
      };

      vi.mocked(SemanticContractService.load).mockResolvedValue(mockContract);
      vi.mocked(generateEngineForNode).mockResolvedValue(mockEngine);
      vi.mocked(generateTestExamplesForNode).mockResolvedValue(['example1']);
      vi.mocked(EngineEscalationService.save).mockResolvedValue(undefined);

      const results = await executeGenerationPlan(plan, taskTree);

      expect(generateContractForNode).not.toHaveBeenCalled();
      expect(SemanticContractService.load).toHaveBeenCalledWith('node1');
      expect(results.get('node1')?.contract).toEqual(mockContract);
    });
  });

  describe('pipeline execution for multiple nodes', () => {
    it('should execute pipeline for multiple nodes', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Node 1',
            generateContract: true,
            generateEngines: ['regex'],
            generateEscalation: true,
            generateTests: true
          },
          {
            nodeId: 'node2',
            nodeLabel: 'Node 2',
            generateContract: true,
            generateEngines: ['llm'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 8
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Node 1' } as TaskTreeNode,
          { id: 'node2', label: 'Node 2' } as TaskTreeNode
        ]
      };

      const mockContract1: SemanticContract = {
        entity: { label: 'Node 1', type: 'text', description: 'Text' },
        outputCanonical: { format: 'value' }
      };

      const mockContract2: SemanticContract = {
        entity: { label: 'Node 2', type: 'text', description: 'Text' },
        outputCanonical: { format: 'value' }
      };

      vi.mocked(generateContractForNode)
        .mockResolvedValueOnce(mockContract1)
        .mockResolvedValueOnce(mockContract2);
      vi.mocked(generateEngineForNode)
        .mockResolvedValue({
          type: 'regex',
          config: { regex: '\\d+' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        })
        .mockResolvedValue({
          type: 'llm',
          config: { llmPrompt: 'Extract' },
          version: 1,
          generatedAt: new Date(),
          generatedBy: 'ai'
        });
      vi.mocked(generateTestExamplesForNode).mockResolvedValue(['example']);
      vi.mocked(EngineEscalationService.save).mockResolvedValue(undefined);

      const results = await executeGenerationPlan(plan, taskTree);

      expect(results.size).toBe(2);
      expect(results.get('node1')?.success).toBe(true);
      expect(results.get('node2')?.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should continue pipeline when one engine fails', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: true,
            generateEngines: ['regex', 'llm'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 5
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Test Node' } as TaskTreeNode
        ]
      };

      const mockContract: SemanticContract = {
        entity: { label: 'Test Node', type: 'text', description: 'Text' },
        outputCanonical: { format: 'value' }
      };

      const mockEngine: EngineConfig = {
        type: 'llm',
        config: { llmPrompt: 'Extract' },
        version: 1,
        generatedAt: new Date(),
        generatedBy: 'ai'
      };

      vi.mocked(generateContractForNode).mockResolvedValue(mockContract);
      vi.mocked(generateEngineForNode)
        .mockResolvedValueOnce(null) // regex fails
        .mockResolvedValueOnce(mockEngine); // llm succeeds
      vi.mocked(generateTestExamplesForNode).mockResolvedValue(['example']);
      vi.mocked(EngineEscalationService.save).mockResolvedValue(undefined);

      const results = await executeGenerationPlan(plan, taskTree);

      const result = results.get('node1');
      expect(result?.success).toBe(true); // Still succeeds because one engine worked
      expect(result?.engines?.size).toBe(1);
      expect(result?.engines?.get('llm')).toEqual(mockEngine);
      expect(result?.errors).toContain('Failed to generate regex engine');
    });

    it('should mark as failed when all engines fail', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: true,
            generateEngines: ['regex', 'llm'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 5
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Test Node' } as TaskTreeNode
        ]
      };

      const mockContract: SemanticContract = {
        entity: { label: 'Test Node', type: 'text', description: 'Text' },
        outputCanonical: { format: 'value' }
      };

      vi.mocked(generateContractForNode).mockResolvedValue(mockContract);
      vi.mocked(generateEngineForNode).mockResolvedValue(null); // All engines fail
      vi.mocked(generateTestExamplesForNode).mockResolvedValue(['example']);
      vi.mocked(EngineEscalationService.save).mockResolvedValue(undefined);

      const results = await executeGenerationPlan(plan, taskTree);

      const result = results.get('node1');
      expect(result?.success).toBe(false);
      expect(result?.errors?.length).toBe(2);
    });

    it('should handle missing contract', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: false,
            generateEngines: ['regex'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 4
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Test Node' } as TaskTreeNode
        ]
      };

      vi.mocked(SemanticContractService.load).mockResolvedValue(null);

      const results = await executeGenerationPlan(plan, taskTree);

      const result = results.get('node1');
      expect(result?.success).toBe(false);
      expect(result?.errors).toContain('Contract is required but not available');
    });

    it('should handle node not found in tree', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: true,
            generateEngines: [],
            generateEscalation: false,
            generateTests: false
          }
        ],
        totalSteps: 1
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node2', label: 'Other Node' } as TaskTreeNode
        ]
      };

      const results = await executeGenerationPlan(plan, taskTree);

      const result = results.get('node1');
      expect(result?.success).toBe(false);
      expect(result?.errors).toContain('Node not found in tree');
    });
  });

  describe('progress reporting', () => {
    it('should call onProgress with correct step numbers', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [
          {
            nodeId: 'node1',
            nodeLabel: 'Test Node',
            generateContract: true,
            generateEngines: ['regex'],
            generateEscalation: true,
            generateTests: true
          }
        ],
        totalSteps: 4
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Test Node' } as TaskTreeNode
        ]
      };

      const mockContract: SemanticContract = {
        entity: { label: 'Test Node', type: 'text', description: 'Text' },
        outputCanonical: { format: 'value' }
      };

      const progressCalls: GenerationProgress[] = [];

      vi.mocked(generateContractForNode).mockImplementation(async (node, onProgress) => {
        if (onProgress) {
          onProgress({
            currentStep: 1,
            totalSteps: 1,
            currentNodeId: 'node1',
            currentNodeLabel: 'Test Node',
            currentAction: 'Generating contract',
            percentage: 100
          });
        }
        return mockContract;
      });

      vi.mocked(generateEngineForNode).mockResolvedValue({
        type: 'regex',
        config: { regex: '\\d+' },
        version: 1,
        generatedAt: new Date(),
        generatedBy: 'ai'
      });

      vi.mocked(generateTestExamplesForNode).mockResolvedValue(['example']);
      vi.mocked(EngineEscalationService.save).mockResolvedValue(undefined);

      await executeGenerationPlan(plan, taskTree, (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      // Verify that step numbers are adjusted to global plan
      const contractProgress = progressCalls.find(p => p.currentAction.includes('contract'));
      expect(contractProgress?.totalSteps).toBe(4); // Should use plan totalSteps
    });
  });

  describe('edge cases', () => {
    it('should return empty map for null task tree', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [],
        totalSteps: 0
      };

      const results = await executeGenerationPlan(plan, null);

      expect(results.size).toBe(0);
    });

    it('should handle plan with no nodes to generate', async () => {
      const plan: GenerationPlan = {
        nodesToGenerate: [],
        totalSteps: 0
      };

      const taskTree: TaskTree = {
        nodes: [
          { id: 'node1', label: 'Test Node' } as TaskTreeNode
        ]
      };

      const results = await executeGenerationPlan(plan, taskTree);

      expect(results.size).toBe(0);
    });
  });
});
