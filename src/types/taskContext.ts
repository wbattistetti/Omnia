/**
 * Task Context Types
 *
 * Defines where tasks can be used in the system.
 * Uses enums for type safety and autocomplete.
 */

export enum TaskContext {
  ESCALATION = 'escalation',
  CONDITION = 'condition',
  VALIDATOR = 'validator',
  PREAMBLE = 'preamble',
}

export enum EscalationStepType {
  START = 'start',
  NO_MATCH = 'noMatch',
  NO_INPUT = 'noInput',
  CONFIRMATION = 'confirmation',
  SUCCESS = 'success',
  INTRODUCTION = 'introduction',
}

/**
 * Allowed context type: either a generic context or a specific escalation step
 * Examples:
 * - 'escalation' (all escalation steps)
 * - 'escalation:start' (only start step)
 * - 'condition' (in conditions)
 */
export type AllowedContext = TaskContext | `${TaskContext}:${EscalationStepType}`;

/**
 * Helper: Create an escalation-specific context string
 */
export function escalationContext(stepType: EscalationStepType): AllowedContext {
  return `${TaskContext.ESCALATION}:${stepType}`;
}

/**
 * Helper: Parse an allowed context to extract context and step type
 */
export function parseAllowedContext(context: AllowedContext): {
  context: TaskContext;
  stepType?: EscalationStepType;
} {
  if (context.includes(':')) {
    const [ctx, step] = context.split(':');
    return {
      context: ctx as TaskContext,
      stepType: step as EscalationStepType,
    };
  }
  return {
    context: context as TaskContext,
  };
}
