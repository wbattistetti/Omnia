// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Pipeline State Tests
 *
 * Unit tests for pipeline state management functions.
 * Tests progress tracking and percentage calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialPipelineProgress,
  updateStepStatus,
  updateStepPercentage,
  updateOverallPercentage,
  isPipelineComplete,
  hasPipelineErrors
} from '../../state/pipelineState';
import type { PipelineStep, StepStatus } from '../../types/pipeline.types';

describe('pipelineState', () => {
  describe('createInitialPipelineProgress', () => {
    it('should create initial progress with all steps pending', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      expect(progress.nodeId).toBe('node-1');
      expect(progress.nodeLabel).toBe('Node 1');
      expect(progress.percentage).toBe(0);

      const steps = Object.values(progress.steps);
      expect(steps).toHaveLength(7);
      expect(steps.every(s => s.status === 'pending')).toBe(true);
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status to processing', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      const updated = updateStepStatus(
        progress,
        'contract-refinement',
        'processing',
        'Refining contract...'
      );
      expect(updated.steps['contract-refinement'].status).toBe('processing');
      expect(updated.steps['contract-refinement'].message).toBe('Refining contract...');
      expect(updated.currentStep).toBe('contract-refinement');
    });

    it('should update step status to completed', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      const updated = updateStepStatus(
        progress,
        'contract-refinement',
        'completed',
        'Contract refined'
      );
      expect(updated.steps['contract-refinement'].status).toBe('completed');
      expect(updated.steps['contract-refinement'].message).toBe('Contract refined');
    });

    it('should update step status to error', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      const updated = updateStepStatus(
        progress,
        'contract-refinement',
        'error',
        undefined,
        'Test error'
      );
      expect(updated.steps['contract-refinement'].status).toBe('error');
      expect(updated.steps['contract-refinement'].error).toBe('Test error');
      expect(updated.error).toBe('Test error');
    });
  });

  describe('updateStepPercentage', () => {
    it('should update step percentage', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      const updated = updateStepPercentage(progress, 'contract-refinement', 50);
      expect(updated.steps['contract-refinement'].percentage).toBe(50);
    });
  });

  describe('updateOverallPercentage', () => {
    it('should calculate 0% when all steps are pending', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      const updated = updateOverallPercentage(progress);
      expect(updated.percentage).toBe(0);
    });

    it('should calculate 100% when all steps are completed', () => {
      let progress = createInitialPipelineProgress('node-1', 'Node 1');
      const steps: PipelineStep[] = [
        'contract-refinement',
        'canonical-values',
        'constraints',
        'engines',
        'escalation',
        'test-examples',
        'ai-messages'
      ];

      for (const step of steps) {
        progress = updateStepStatus(progress, step, 'completed');
      }

      const updated = updateOverallPercentage(progress);
      expect(updated.percentage).toBe(100);
      expect(updated.completedAt).toBeDefined();
    });

    it('should calculate partial percentage when some steps are completed', () => {
      let progress = createInitialPipelineProgress('node-1', 'Node 1');
      progress = updateStepStatus(progress, 'contract-refinement', 'completed');
      progress = updateStepStatus(progress, 'canonical-values', 'completed');
      progress = updateStepStatus(progress, 'constraints', 'processing');
      progress = updateStepPercentage(progress, 'constraints', 50);

      const updated = updateOverallPercentage(progress);
      // 2 completed (100% each) + 1 processing (50%) = ~35.7% overall
      expect(updated.percentage).toBeGreaterThan(0);
      expect(updated.percentage).toBeLessThan(100);
    });
  });

  describe('isPipelineComplete', () => {
    it('should return false when steps are pending', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      expect(isPipelineComplete(progress)).toBe(false);
    });

    it('should return true when all steps are completed', () => {
      let progress = createInitialPipelineProgress('node-1', 'Node 1');
      const steps: PipelineStep[] = [
        'contract-refinement',
        'canonical-values',
        'constraints',
        'engines',
        'escalation',
        'test-examples',
        'ai-messages'
      ];

      for (const step of steps) {
        progress = updateStepStatus(progress, step, 'completed');
      }

      expect(isPipelineComplete(progress)).toBe(true);
    });

    it('should return true when all steps are completed or skipped', () => {
      let progress = createInitialPipelineProgress('node-1', 'Node 1');
      progress = updateStepStatus(progress, 'contract-refinement', 'completed');
      progress = updateStepStatus(progress, 'escalation', 'skipped');
      expect(isPipelineComplete(progress)).toBe(false); // Not all completed
    });
  });

  describe('hasPipelineErrors', () => {
    it('should return false when no errors', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      expect(hasPipelineErrors(progress)).toBe(false);
    });

    it('should return true when any step has error', () => {
      const progress = createInitialPipelineProgress('node-1', 'Node 1');
      const updated = updateStepStatus(
        progress,
        'contract-refinement',
        'error',
        undefined,
        'Test error'
      );
      expect(hasPipelineErrors(updated)).toBe(true);
    });
  });
});
