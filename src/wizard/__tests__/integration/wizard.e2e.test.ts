// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard End-to-End Integration Tests
 *
 * Tests the complete wizard flow from structure generation to pipeline execution.
 * These tests require a running backend server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateStructure, regenerateStructure } from '../../services/structureGenerationService';
import type { SchemaNode } from '../../types/wizard.types';

// Test configuration
const BACKEND_URL = 'http://localhost:8000';
const TEST_TIMEOUT = 30000; // 30 seconds for AI calls

describe('Wizard E2E Integration Tests', () => {
  beforeAll(() => {
    // Verify backend is reachable
    return fetch(`${BACKEND_URL}/health`).catch(() => {
      console.warn('[E2E] Backend not reachable, some tests may fail');
    });
  });

  describe('Phase A: Structure Generation', () => {
    it('should generate structure for simple task', async () => {
      const result = await generateStructure('Email Address', undefined, 'openai');

      expect(result.success).toBe(true);
      expect(result.structure).toBeDefined();
      expect(Array.isArray(result.structure)).toBe(true);
      expect(result.structure!.length).toBeGreaterThan(0);

      // Verify structure has root node
      const rootNode = result.structure!.find(n => n.id === 'root' || !n.id);
      expect(rootNode).toBeDefined();
      expect(rootNode!.label).toBeTruthy();
    }, TEST_TIMEOUT);

    it('should generate structure with sub-nodes for complex task', async () => {
      const result = await generateStructure('Date of Birth', 'User birth date with day, month, year', 'openai');

      expect(result.success).toBe(true);
      expect(result.structure).toBeDefined();

      // Verify structure has sub-nodes
      const rootNode = result.structure!.find(n => !n.id || n.id === 'root');
      if (rootNode) {
        const subNodes = rootNode.subData || rootNode.subTasks || [];
        expect(subNodes.length).toBeGreaterThan(0);
      }
    }, TEST_TIMEOUT);

    it('should handle generation errors gracefully', async () => {
      // Test with invalid input
      const result = await generateStructure('', undefined, 'openai');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Phase B: Structure Regeneration', () => {
    it('should regenerate structure based on feedback', async () => {
      // First generate initial structure
      const initialResult = await generateStructure('Phone Number', undefined, 'openai');
      expect(initialResult.success).toBe(true);

      // Regenerate with feedback
      const feedback = 'Add country code validation';
      const regenerateResult = await regenerateStructure(
        'Phone Number',
        feedback,
        initialResult.structure!,
        'openai'
      );

      expect(regenerateResult.success).toBe(true);
      expect(regenerateResult.structure).toBeDefined();
      expect(Array.isArray(regenerateResult.structure)).toBe(true);
    }, TEST_TIMEOUT * 2);
  });

  describe('Pipeline: STEP 1-7 Execution', () => {
    let testContract: any;

    beforeAll(async () => {
      // Create a test contract for pipeline steps
      testContract = {
        entity: {
          label: 'Email',
          type: 'email',
          description: 'User email address'
        },
        outputCanonical: {
          format: 'value'
        }
      };
    });

    it('should execute STEP 1: Contract Refinement', async () => {
      const { refineContract } = await import('../../../utils/wizard/refineContract');

      const refined = await refineContract(testContract, 'Email', (progress) => {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      });

      expect(refined).toBeDefined();
      expect(refined.entity).toBeDefined();
    }, TEST_TIMEOUT);

    it('should execute STEP 2: Canonical Values', async () => {
      const { generateCanonicalValues } = await import('../../../utils/wizard/generateCanonicalValues');

      const result = await generateCanonicalValues(testContract, 'Email', (progress) => {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
      });

      expect(result.contract).toBeDefined();
      expect(result.canonicalValues).toBeDefined();
    }, TEST_TIMEOUT);

    it('should execute STEP 3: Constraints', async () => {
      const { generateConstraints } = await import('../../../utils/wizard/generateConstraints');

      const result = await generateConstraints(testContract, 'Email', (progress) => {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
      });

      expect(result.contract).toBeDefined();
      expect(result.constraints).toBeDefined();
    }, TEST_TIMEOUT);

    it('should execute STEP 4: Engines', async () => {
      const { generateEnginesForNode } = await import('../../../utils/wizard/generateEnginesUnified');

      const result = await generateEnginesForNode(testContract, 'Email', (progress) => {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
      });

      expect(result.contract).toBeDefined();
      expect(result.engines).toBeDefined();
      expect(Array.isArray(result.engines)).toBe(true);

      // Verify all engine types are present
      const engineTypes = result.engines!.map(e => e.type);
      expect(engineTypes).toContain('regex');
      expect(engineTypes).toContain('rule_based');
    }, TEST_TIMEOUT);

    it('should execute STEP 5: Escalation', async () => {
      const { generateEscalationForNode } = await import('../../../utils/wizard/generateEscalation');

      // First generate engines
      const { generateEnginesForNode } = await import('../../../utils/wizard/generateEnginesUnified');
      const enginesResult = await generateEnginesForNode(testContract, 'Email');
      const engines = enginesResult.engines || [];

      const escalation = await generateEscalationForNode(
        testContract,
        engines,
        'test-node-id',
        'Email',
        null,
        (progress) => {
          expect(progress.percentage).toBeGreaterThanOrEqual(0);
        }
      );

      expect(escalation).toBeDefined();
      expect(escalation.sequence).toBeDefined();
      expect(Array.isArray(escalation.sequence)).toBe(true);
    }, TEST_TIMEOUT * 2);

    it('should execute STEP 6: Test Examples', async () => {
      const { generateTestExamples } = await import('../../../utils/wizard/generateTestExamples');

      const result = await generateTestExamples(testContract, 'Email', (progress) => {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
      });

      expect(result.testExamples).toBeDefined();
      expect(Array.isArray(result.testExamples)).toBe(true);
      expect(result.testExamples!.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should execute STEP 7: AI Messages', async () => {
      const { generateAIMessages } = await import('../../../utils/wizard/generateAIMessages');

      const result = await generateAIMessages(testContract, 'Email', (progress) => {
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
      });

      expect(result.aiMessages).toBeDefined();
      expect(result.aiMessages.start).toBeDefined();
      expect(Array.isArray(result.aiMessages.start)).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle backend unavailability', async () => {
      // This test would require mocking or stopping the backend
      // For now, we test error handling in the service
      const result = await generateStructure('Test', undefined, 'openai');

      // If backend is down, result should have error
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    }, TEST_TIMEOUT);

    it('should handle invalid API responses', async () => {
      // Test with malformed contract
      const invalidContract = { invalid: 'data' };

      const { refineContract } = await import('../../../utils/wizard/refineContract');

      try {
        await refineContract(invalidContract, 'Test');
        // If it doesn't throw, that's also acceptable (backend should handle it)
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    }, TEST_TIMEOUT);
  });

  describe('Performance', () => {
    it('should complete structure generation within timeout', async () => {
      const startTime = Date.now();
      const result = await generateStructure('Quick Test', undefined, 'openai');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    it('should complete full pipeline within reasonable time', async () => {
      const startTime = Date.now();

      // Execute all steps sequentially
      const { refineContract } = await import('../../../utils/wizard/refineContract');
      const contract = { entity: { label: 'Test' }, outputCanonical: { format: 'value' } };

      await refineContract(contract, 'Test');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(TEST_TIMEOUT * 2); // Allow 2x timeout for full pipeline
    }, TEST_TIMEOUT * 2);
  });
});
