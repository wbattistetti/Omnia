/**
 * Active Tutor — contesto runtime per script deterministici (non LLM).
 */

export interface TutorScriptContext {
  /** `task.agentDesignDescription.trim()` */
  readonly designDescriptionTrimmed: string;
  /** True dopo la prima generazione agente. */
  readonly hasAgentGeneration: boolean;
}

export const EMPTY_TUTOR_SCRIPT_CONTEXT: TutorScriptContext = {
  designDescriptionTrimmed: '',
  hasAgentGeneration: false,
};

export function isTaskDescriptionEmpty(ctx: TutorScriptContext): boolean {
  return ctx.designDescriptionTrimmed.length === 0;
}
