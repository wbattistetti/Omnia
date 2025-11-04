// Helper functions for row and DDT validation in flow orchestrator
// These functions centralize the logic for determining interactivity and retrieving DDTs

import { instanceRepository } from '../../../services/InstanceRepository';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

export interface DDTValidationResult {
  valid: boolean;
  reason?: 'DDT_MISSING' | 'DDT_EMPTY' | 'DDT_NO_INTENT_MESSAGES' | 'DDT_INVALID_KIND' | 'DDT_MISSING_LABEL' | 'DDT_NO_CONFIRMATION';
}

/**
 * Retrieves DDT for a row, checking instance first, then template fallback
 * Priority: instance.ddt > template.ddt
 * @param row - The row from the flowchart node
 * @param resolveAct - Function to resolve act from template (from useFlowOrchestrator)
 * @param toAssembled - Function to normalize DDT format (from useFlowOrchestrator)
 * @returns AssembledDDT or null if not found
 */
/**
 * Get DDT for a row - NO FALLBACK, only from instance
 * Fails fast if DDT is not in instance - this is intentional to avoid hidden errors
 * @param row - The row from the flowchart node
 * @param resolveAct - Function to resolve act from template (unused, kept for API compatibility)
 * @param toAssembled - Function to normalize DDT format
 * @returns AssembledDDT or null if not found in instance
 */
export function getDDTForRow(
  row: any,
  resolveAct: (row: any) => any,
  toAssembled: (raw: any) => AssembledDDT | null
): AssembledDDT | null {
  try {
    const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';

    // Only check instance - NO FALLBACK to template
    // This ensures we fail fast if DDT is missing, instead of hiding the error
    const instanceId = row?.id;
    if (!instanceId) {
      if (debugEnabled) {
        console.warn('[getDDTForRow][NO_INSTANCE_ID]', { rowId: row?.id, rowText: row?.text });
      }
      return null;
    }

    const instance = instanceRepository.getInstance(instanceId);
    if (!instance) {
      if (debugEnabled) {
        console.warn('[getDDTForRow][NO_INSTANCE]', { instanceId, rowText: row?.text });
      }
      return null;
    }

    if (!instance.ddt) {
      if (debugEnabled) {
        console.warn('[getDDTForRow][NO_DDT_IN_INSTANCE]', { instanceId, rowText: row?.text });
      }
      return null;
    }

    if (debugEnabled) {
      console.log('[getDDTForRow][BEFORE_TOASSEMBLED]', {
        instanceId,
        rawDDT: {
          id: instance.ddt?.id,
          label: instance.ddt?.label,
          mainData: instance.ddt?.mainData ? (Array.isArray(instance.ddt.mainData) ? {
            count: instance.ddt.mainData.length,
            firstMain: {
              kind: instance.ddt.mainData[0]?.kind,
              label: instance.ddt.mainData[0]?.label,
              stepsKeys: instance.ddt.mainData[0]?.steps ? Object.keys(instance.ddt.mainData[0].steps) : [],
              stepsType: Array.isArray(instance.ddt.mainData[0]?.steps) ? 'array' : typeof instance.ddt.mainData[0]?.steps,
              stepsStart: instance.ddt.mainData[0]?.steps?.start
            }
          } : {
            kind: instance.ddt.mainData?.kind,
            label: instance.ddt.mainData?.label,
            stepsKeys: instance.ddt.mainData?.steps ? Object.keys(instance.ddt.mainData.steps) : [],
            stepsType: Array.isArray(instance.ddt.mainData?.steps) ? 'array' : typeof instance.ddt.mainData?.steps,
            stepsStart: instance.ddt.mainData?.steps?.start
          }) : null
        }
      });
    }

    const assembled = toAssembled(instance.ddt);

    if (debugEnabled && assembled) {
      console.log('[getDDTForRow][AFTER_TOASSEMBLED]', {
        instanceId,
        assembled: {
          id: assembled?.id,
          label: assembled?.label,
          mainData: assembled?.mainData ? (Array.isArray(assembled.mainData) ? {
            count: assembled.mainData.length,
            firstMain: {
              kind: assembled.mainData[0]?.kind,
              label: assembled.mainData[0]?.label,
              stepsKeys: assembled.mainData[0]?.steps ? Object.keys(assembled.mainData[0].steps) : [],
              stepsType: Array.isArray(assembled.mainData[0]?.steps) ? 'array' : typeof assembled.mainData[0]?.steps,
              stepsStart: assembled.mainData[0]?.steps?.start,
              stepsFull: JSON.stringify(assembled.mainData[0]?.steps, null, 2).substring(0, 500)
            }
          } : {
            kind: (assembled.mainData as any)?.kind,
            label: (assembled.mainData as any)?.label,
            stepsKeys: (assembled.mainData as any)?.steps ? Object.keys((assembled.mainData as any).steps) : [],
            stepsType: Array.isArray((assembled.mainData as any)?.steps) ? 'array' : typeof (assembled.mainData as any)?.steps,
            stepsStart: (assembled.mainData as any)?.steps?.start,
            stepsFull: JSON.stringify((assembled.mainData as any)?.steps, null, 2).substring(0, 500)
          }) : null
        }
      });
    }

    return assembled;
  } catch (err) {
    console.error('[getDDTForRow][ERROR]', err, { rowId: row?.id, rowText: row?.text });
    return null;
  }
}

/**
 * Validates DDT structure and content
 * @param ddt - The DDT to validate
 * @param expectedKind - Optional expected kind ('intent' | 'data' | etc.) for context-specific validation
 * @param basicOnly - If true, only validates basic structure (mainData, label) without type-specific checks
 * @returns Validation result with reason if invalid
 */
export function validateDDT(ddt: AssembledDDT | null, expectedKind?: 'intent' | 'data' | string, basicOnly: boolean = false): DDTValidationResult {
  // Check if DDT exists
  if (!ddt) {
    return { valid: false, reason: 'DDT_MISSING' };
  }

  // Check mainData structure
  const mainData = Array.isArray(ddt.mainData) ? ddt.mainData : (ddt.mainData ? [ddt.mainData] : []);
  if (mainData.length === 0) {
    return { valid: false, reason: 'DDT_EMPTY' };
  }

  const firstMain = mainData[0];

  // Check label presence (required for engine)
  if (!firstMain?.label || String(firstMain.label).trim().length === 0) {
    return { valid: false, reason: 'DDT_MISSING_LABEL' };
  }

  // Basic validation only: if basicOnly is true, return here (no type-specific checks)
  if (basicOnly) {
    return { valid: true };
  }

  // Check kind coherence if expectedKind is provided
  if (expectedKind && firstMain.kind && firstMain.kind !== expectedKind) {
    return { valid: false, reason: 'DDT_INVALID_KIND' };
  }

  // For intent kind, validate messages (only if not basicOnly)
  if (firstMain.kind === 'intent' || expectedKind === 'intent') {
    const steps = firstMain.steps || {};
    const requiredSteps = ['start', 'noInput', 'noMatch', 'confirmation'];

    // Check if each required step has at least one escalation with a message
    for (const stepKey of requiredSteps) {
      const step = steps[stepKey];
      if (!step) {
        return { valid: false, reason: 'DDT_NO_INTENT_MESSAGES' };
      }

      const escalations = Array.isArray(step.escalations) ? step.escalations : [];
      if (escalations.length === 0) {
        return { valid: false, reason: 'DDT_NO_INTENT_MESSAGES' };
      }

      // Check if at least one escalation has an action with a text value
      const hasMessage = escalations.some((esc: any) => {
        const actions = Array.isArray(esc.actions) ? esc.actions : [];
        return actions.some((action: any) => {
          const params = Array.isArray(action.parameters) ? action.parameters : [];
          return params.some((param: any) => {
            // Can be direct text value or textKey
            return param.value || param.textKey;
          });
        });
      });

      if (!hasMessage) {
        return { valid: false, reason: 'DDT_NO_INTENT_MESSAGES' };
      }
    }

    // Additional check: confirmation must have at least one message
    const confirmationStep = steps.confirmation;
    if (!confirmationStep || !Array.isArray(confirmationStep.escalations) || confirmationStep.escalations.length === 0) {
      return { valid: false, reason: 'DDT_NO_CONFIRMATION' };
    }
  }

  return { valid: true };
}

/**
 * Determines if a row is interactive with unified logic
 * Unified rule: A row is interactive if it has a valid DDT in the instance
 * Messages (type='Message') are never interactive (they don't have DDT)
 *
 * @param row - The row from the flowchart node
 * @param resolveAct - Function to resolve act from template (not used in unified logic, kept for compatibility)
 * @param toAssembled - Function to normalize DDT format
 * @returns true if row is interactive and has valid DDT
 */
export function isRowInteractive(
  row: any,
  resolveAct: (row: any) => any,
  toAssembled: (raw: any) => AssembledDDT | null
): boolean {
  try {
    const debugEnabled = localStorage.getItem('debug.chatSimulator') === '1';

    if (debugEnabled) {
      console.log('[isRowInteractive][START]', {
        rowId: row?.id,
        rowText: row?.text,
        rowType: row?.type
      });
    }

    // Unified rule: Messages are never interactive (they don't have DDT)
    if (row?.type === 'Message') {
      if (debugEnabled) {
        console.log('[isRowInteractive][MESSAGE]', {
          rowId: row?.id,
          result: false,
          reason: 'Messages are never interactive'
        });
      }
      return false;
    }

    // Unified rule: All other types are interactive IF they have a valid DDT in the instance
    const instanceId = row?.id;

    if (debugEnabled) {
      console.log('[isRowInteractive][CHECK_INSTANCE]', {
        rowId: row?.id,
        rowType: row?.type,
        instanceId,
        hasInstanceId: !!instanceId
      });
    }

    if (!instanceId) {
      if (debugEnabled) {
        console.warn('[isRowInteractive][NO_INSTANCE_ID]', {
          rowId: row?.id,
          rowType: row?.type,
          result: false
        });
      }
      return false;
    }

    const instance = instanceRepository.getInstance(instanceId);

    if (debugEnabled) {
      console.log('[isRowInteractive][INSTANCE_CHECK]', {
        instanceId,
        hasInstance: !!instance,
        hasDDT: !!instance?.ddt,
        instanceDDTId: instance?.ddt?.id,
        instanceDDTLabel: instance?.ddt?.label
      });
    }

    if (!instance || !instance.ddt) {
      if (debugEnabled) {
        console.warn('[isRowInteractive][NO_DDT]', {
          instanceId,
          hasInstance: !!instance,
          hasDDT: !!instance?.ddt,
          result: false
        });
      }
      return false;
    }

    const assembled = toAssembled(instance.ddt);

    if (debugEnabled) {
      console.log('[isRowInteractive][ASSEMBLED]', {
        instanceId,
        hasAssembled: !!assembled,
        assembledId: assembled?.id,
        assembledLabel: assembled?.label,
        mainDataKind: Array.isArray(assembled?.mainData)
          ? assembled.mainData[0]?.kind
          : (assembled?.mainData as any)?.kind,
        hasStartStep: Array.isArray(assembled?.mainData)
          ? !!assembled.mainData[0]?.steps?.start
          : !!(assembled?.mainData as any)?.steps?.start
      });
    }

    if (!assembled) {
      if (debugEnabled) {
        console.warn('[isRowInteractive][NO_ASSEMBLED]', {
          instanceId,
          result: false
        });
      }
      return false;
    }

    // Unified validation: basic DDT structure validation only (no type-specific checks)
    // Type-specific validation (intent vs data messages) is done later when needed (e.g., when emitting messages)
    // Here we only check: DDT exists, has mainData, has label
    const validation = validateDDT(assembled, undefined, true); // basicOnly = true

    if (debugEnabled) {
      console.log('[isRowInteractive][VALIDATION]', {
        instanceId,
        valid: validation.valid,
        reason: validation.reason,
        result: validation.valid,
        note: 'Using basicOnly validation - message validation done later when emitting'
      });
    }

    return validation.valid;
  } catch (err) {
    console.error('[isRowInteractive][ERROR]', err, { rowId: row?.id, rowType: row?.type });
    return false;
  }
}

