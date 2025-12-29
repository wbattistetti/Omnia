// Types and constants for DDTAssembler StepBuilder

import type { Task } from '../../../types/taskTypes';

/**
 * ActionParameter: Parameter for task execution (e.g., translation key for text)
 */
export type ActionParameter = {
  parameterId: string;
  value: string; // key in translations
};

/**
 * Escalation: Contains tasks to execute in sequence
 *
 * Model:
 * - Each escalation has its own dedicated Tasks (not shared references)
 * - Tasks are complete Task objects (not lightweight references)
 * - Steps are always copied (disconnected from template)
 * - Contracts are inherited from template (unless overridden)
 */
export type Escalation = {
  escalationId: string;
  tasks: Task[];  // Complete Task objects (each escalation has its own tasks)
  // Legacy alias for backward compatibility
  actions?: Task[];  // @deprecated Use tasks instead
};

// Legacy type aliases for backward compatibility
// @deprecated Use Task from taskTypes.ts instead
export type TaskReference = Task;
export type Action = Task;

export type StepGroup = {
  type: 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction';
  escalations: Escalation[];
};

export const KNOWN_ACTIONS = {
  DataRequest: { defaultParameter: 'text' }, // ✅ Aggiunto DataRequest
  sayMessage: { defaultParameter: 'text' }
  // ✅ Rimosso askQuestion (ridondante)
};