/**
 * Build-time flag: structured sections use OT storage when `VITE_AI_AGENT_STRUCTURED_OT` is `"true"`.
 */

export function isStructuredSectionsOtEnabled(): boolean {
  return import.meta.env.VITE_AI_AGENT_STRUCTURED_OT === 'true';
}
