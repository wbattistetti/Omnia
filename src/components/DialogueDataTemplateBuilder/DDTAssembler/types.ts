// Types and constants for DDTAssembler StepBuilder

export type ActionParameter = {
  parameterId: string;
  value: string; // key in translations
};

/**
 * TaskReference: Reference to a TaskInstance in an escalation
 * Replaces: Action (old ambiguous name)
 *
 * A TaskReference points to a TaskInstance (via taskId) and includes
 * escalation-specific parameters that may override the Task's default values.
 */
export type TaskReference = {
  templateId: string;  // ✅ TaskTemplate ID (e.g. "SayMessage", "GetData") - was actionId
  taskId: string;     // ✅ TaskInstance ID (GUID) - was actionInstanceId
  parameters: ActionParameter[];
};

// Legacy type alias for backward compatibility during migration
// @deprecated Use TaskReference instead
export type Action = TaskReference;

export type Escalation = {
  escalationId: string;
  tasks: TaskReference[];  // ✅ Renamed from actions to tasks for clarity
  // Legacy alias for backward compatibility
  actions?: TaskReference[];  // @deprecated Use tasks instead
};

export type StepGroup = {
  type: 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction';
  escalations: Escalation[];
};

export const KNOWN_ACTIONS = {
  askQuestion: { defaultParameter: 'text' },
  sayMessage: { defaultParameter: 'text' }
  // ... altri tipi se servono
};