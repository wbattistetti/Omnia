// Centralized As-Is DDT schema typings used by the current builder/editor pipeline.
// Keep in sync with existing shapes; do not change runtime behavior.

import type { ActionParameter, Escalation, StepGroup } from './types';
import type { Task } from '../../../types/taskTypes';

// Export types
export type { ActionParameter, Escalation, StepGroup };
export type { Task };

// Legacy type aliases for backward compatibility
// @deprecated Use Task from taskTypes.ts instead
export type TaskReference = Task;
export type Action = Task;

// Explicit step type union for current UI/editor expectations
export type StepType = 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction';

// Main data node produced by the assembler today
// ✅ MIGRATION: steps removed (now in dialogueSteps array at DDT level)
export interface dataNode {
  id: string;
  name?: string;
  label?: string;
  type?: string; // e.g., 'date', 'email', etc.
  required?: boolean;
  condition?: string;
  // ⚠️ steps removed - use dialogueSteps array at DDT level instead
  // steps: StepGroup[];  // ❌ DEPRECATED: Use dialogueSteps with dataId reference
  subData?: dataNode[];
  synonyms?: string[]; // embedded synonyms per node (main/sub)
  constraints?: any[]; // kept as any to avoid behavior changes
}

/**
 * @deprecated Use TaskTree instead
 *
 * AssembledDDT è mantenuto solo per backward compatibility durante migrazione.
 *
 * IMPORTANTE:
 * - DDT NON è più un concetto persistito
 * - TaskTree è la vista runtime costruita da Template + Instance
 * - AssembledDDT è ancora usato nel runtime backend (DDTEngine) ma non come entità persistita
 *
 * In futuro, AssembledDDT sarà sostituito completamente da TaskTree nel runtime.
 */
export interface AssembledDDT {
  id: string;
  label: string;
  // ❌ REMOVED: data (legacy format, no longer supported)
  nodes: any[];     // ✅ Required (no longer optional)
  dialogueSteps?: any[]; // ✅ Flat dialogue steps array (replaces nested data[].steps)
  translations: Record<string, string>;
  introduction?: StepGroup; // Optional introduction step at root level (aggregate)
}

// ✅ Alias for TaskTree terminology (backward compatible)
export type AssembledTaskTree = AssembledDDT;


