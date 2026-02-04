// DialogueStep: Flat structure for dialogue steps (replaces nested data[].steps)
// Part of hybrid DDT structure migration

import type { StepGroup, Escalation } from '../components/TaskTreeBuilder/DDTAssembler/types';

/**
 * DialogueStep: Flat representation of a dialogue step
 *
 * Structure:
 * - id: Unique GUID for this step instance
 * - dataId: Reference to data or subData node (links step to data)
 * - type: Step type ('start', 'noMatch', 'noInput', etc.)
 * - escalations: Array of escalations for this step
 *
 * Migration from nested structure:
 * - Before: data[0].steps = [{ type: 'start', escalations: [...] }]
 * - After: dialogueSteps = [{ id: 'guid', dataId: 'data[0].id', type: 'start', escalations: [...] }]
 */
export interface DialogueStep {
  id: string;                    // ✅ GUID univoco per questo step
  dataId: string;                 // ✅ Reference a data[].id o subData[].id
  type: StepGroup['type'];        // ✅ 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction'
  escalations: Escalation[];      // ✅ Array di escalations (stessa struttura di StepGroup)
}

/**
 * Helper: Extract dialogue steps from nested data structure
 * Used during migration to convert nested steps to flat dialogueSteps
 */
export function extractStepsFromNested(data: any[]): DialogueStep[] {
  const dialogueSteps: DialogueStep[] = [];
  const { v4: uuidv4 } = require('uuid');

  function extractFromNode(node: any, dataId: string) {
    if (!node || !node.steps) return;

    // Handle array format: [{ type: 'start', escalations: [...] }]
    if (Array.isArray(node.steps)) {
      for (const step of node.steps) {
        if (step && step.type) {
          dialogueSteps.push({
            id: step.id || uuidv4(),
            dataId: dataId,
            type: step.type,
            escalations: step.escalations || []
          });
        }
      }
    }
    // Handle object format: { start: { escalations: [...] } }
    else if (typeof node.steps === 'object') {
      for (const [stepType, stepValue] of Object.entries(node.steps)) {
        if (stepValue && typeof stepValue === 'object') {
          const step = stepValue as any;
          dialogueSteps.push({
            id: step.id || uuidv4(),
            dataId: dataId,
            type: stepType as StepGroup['type'],
            escalations: step.escalations || []
          });
        }
      }
    }
  }

  // Extract from data nodes
  for (const mainNode of data || []) {
    if (mainNode.id) {
      extractFromNode(mainNode, mainNode.id);
    }

    // Extract from subData nodes
    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      for (const subNode of mainNode.subData) {
        if (subNode.id) {
          extractFromNode(subNode, subNode.id);
        }
      }
    }
  }

  return dialogueSteps;
}

/**
 * Helper: Build nested steps structure from flat dialogueSteps (for backward compatibility)
 * Used temporarily during migration to support code that still expects nested structure
 */
export function buildNestedStepsFromFlat(dialogueSteps: DialogueStep[], dataId: string): StepGroup[] | undefined {
  const stepsForData = dialogueSteps.filter(s => s.dataId === dataId);
  if (stepsForData.length === 0) return undefined;

  return stepsForData.map(step => ({
    type: step.type,
    escalations: step.escalations
  }));
}

/**
 * Helper: Get dialogue steps for a specific dataId
 */
export function getDialogueStepsForData(dialogueSteps: DialogueStep[], dataId: string): DialogueStep[] {
  return dialogueSteps.filter(s => s.dataId === dataId);
}

/**
 * Helper: Get a specific dialogue step (by dataId and type)
 */
export function getDialogueStep(dialogueSteps: DialogueStep[], dataId: string, stepType: StepGroup['type']): DialogueStep | undefined {
  return dialogueSteps.find(s => s.dataId === dataId && s.type === stepType);
}

