// DDT Step Execution - Backend Runtime
// Copied from frontend and adapted for backend

import type { DDTNavigatorCallbacks } from './types';
import { resolveActionText } from './utils';

/**
 * Gets step type name for NoMatch based on attempt count
 * DDT uses 'noMatch' step type with escalations
 */
export function getNoMatchStep(attemptCount: number): string {
  return 'noMatch';
}

/**
 * Gets step type name for NoInput based on attempt count
 * DDT uses 'noInput' step type with escalations
 */
export function getNoInputStep(attemptCount: number): string {
  return 'noInput';
}

/**
 * Gets step from node based on step type
 * Steps can be:
 * 1. StepGroup[] with type property (new format)
 * 2. Object with step types as keys (legacy format)
 */
export function getStep(node: any, stepType: string): any {
  if (!node.steps) return null;

  // New format: StepGroup[] array
  if (Array.isArray(node.steps)) {
    return node.steps.find((s: any) => s.type === stepType) || null;
  }

  // Legacy format: object with step types as keys
  if (typeof node.steps === 'object') {
    // Try direct key access
    if (node.steps[stepType]) {
      return node.steps[stepType];
    }

    // Try case-insensitive match
    const lowerStepType = stepType.toLowerCase();
    for (const key in node.steps) {
      if (key.toLowerCase() === lowerStepType) {
        return node.steps[key];
      }
    }
  }

  return null;
}

/**
 * Gets escalation recovery for a step based on escalation type and level
 * StepGroup has escalations array
 */
export function getEscalationRecovery(
  step: any,
  escalationType: 'noMatch' | 'noInput' | 'notConfirmed',
  level: number
): any {
  if (!step || !step.escalations) return null;

  const escalations = Array.isArray(step.escalations) ? step.escalations : [step.escalations];

  // Filter by type if escalation has type property
  const filtered = escalations.filter((e: any) => {
    if (e.type === escalationType || e.escalationType === escalationType) return true;
    // If step type matches escalation type (e.g., step type 'noMatch' for escalationType 'noMatch')
    if (step.type === escalationType) return true;
    return false;
  });

  // Use filtered if available, otherwise use all escalations
  const targetEscalations = filtered.length > 0 ? filtered : escalations;

  // Level is 1-indexed, array is 0-indexed
  const index = level - 1;
  if (index >= 0 && index < targetEscalations.length) {
    return targetEscalations[index];
  }

  // If exceeds, return last available
  if (targetEscalations.length > 0) {
    return targetEscalations[targetEscalations.length - 1];
  }

  return null;
}

/**
 * Executes a step by running its escalations' actions
 * Can also execute an escalation directly (if it has actions instead of escalations)
 * StepGroup has escalations array, each escalation has actions array
 */
export async function executeStep(
  stepOrEscalation: any,
  callbacks: DDTNavigatorCallbacks,
  stepType?: string,
  escalationNumber?: number,
  inputValue?: any // Value to replace {input} placeholder
): Promise<void> {
  // If it's an escalation (has actions directly), execute it
  if (stepOrEscalation?.actions && !stepOrEscalation?.escalations) {
    const actions = Array.isArray(stepOrEscalation.actions) ? stepOrEscalation.actions : [stepOrEscalation.actions];

    for (const action of actions) {
      await executeAction(action, callbacks, stepType, escalationNumber, inputValue);
    }
    return;
  }

  // Otherwise, it's a step (has escalations)
  if (!stepOrEscalation || !stepOrEscalation.escalations) {
    console.warn('[ddtSteps][executeStep] No step or escalations', {
      hasStep: !!stepOrEscalation,
      hasEscalations: !!stepOrEscalation?.escalations
    });
    return;
  }

  const escalations = Array.isArray(stepOrEscalation.escalations) ? stepOrEscalation.escalations : [stepOrEscalation.escalations];

  // Execute first escalation (usually the main action)
  if (escalations.length > 0) {
    const firstEscalation = escalations[0];
    if (firstEscalation && firstEscalation.actions) {
      const actions = Array.isArray(firstEscalation.actions) ? firstEscalation.actions : [firstEscalation.actions];

      for (const action of actions) {
        await executeAction(action, callbacks, stepType, escalationNumber, inputValue);
      }
    } else {
      console.warn('[ddtSteps][executeStep] First escalation has no actions');
    }
  } else {
    console.warn('[ddtSteps][executeStep] No escalations found');
  }
}

/**
 * Executes a single action by resolving its text and calling onMessage
 */
async function executeAction(
  action: any,
  callbacks: DDTNavigatorCallbacks,
  stepType?: string,
  escalationNumber?: number,
  inputValue?: any // Value to replace {input} placeholder
): Promise<void> {
  // Resolve action text from parameters and translations
  try {
    const translations = callbacks.translations || {};
    let text = resolveActionText(action, translations);

    // Replace {input} placeholder with actual input value if provided
    if (text && inputValue !== undefined && inputValue !== null) {
      // Format input value for display
      const inputDisplay = typeof inputValue === 'object'
        ? JSON.stringify(inputValue)
        : String(inputValue);
      text = text.replace(/{input}/g, inputDisplay);
    }

    if (text && callbacks.onMessage) {
      console.log('[ddtSteps][executeAction] ✅ Sending message', {
        stepType,
        escalationNumber,
        textLength: text.length,
        textPreview: text.substring(0, 100),
        hasInputValue: inputValue !== undefined
      });
      callbacks.onMessage(text, stepType, escalationNumber);
    } else {
      console.error('[ddtSteps][executeAction] ❌ CANNOT SEND MESSAGE', {
        hasText: !!text,
        hasOnMessage: !!callbacks.onMessage,
        reason: !text ? 'No text resolved' : 'No onMessage callback',
        stepType,
        escalationNumber
      });
    }
  } catch (error) {
    console.error('[ddtSteps][executeAction] Error resolving action text', error);
    // Fallback: try to get text from parameters directly
    if (action.parameters && action.parameters.length > 0) {
      const textParam = action.parameters.find((p: any) =>
        p.parameterId === 'text' || p.parameterId === 'message'
      );
      if (textParam && textParam.value && callbacks.onMessage) {
        callbacks.onMessage(textParam.value, stepType, escalationNumber);
      }
    }
  }
}

/**
 * Checks if a recovery has an exit action
 */
export function hasExitAction(recovery: any): boolean {
  if (!recovery || !recovery.actions) return false;

  const actions = Array.isArray(recovery.actions) ? recovery.actions : [recovery.actions];
  return actions.some((a: any) =>
    a.type === 'Exit' ||
    a.action === 'Exit' ||
    a.exitAction === true ||
    a.value?.exitAction === true
  );
}



