/**
 * Modalità deploy ConvAI sul task AI Agent: legacy (catalogo UC nel prompt) vs dialogo KB deterministico.
 */

export const AGENT_CONVAI_DEPLOY_MODES = ['legacy', 'kb_deterministic'] as const;

export type AgentConvaiDeployMode = (typeof AGENT_CONVAI_DEPLOY_MODES)[number];

export const DEFAULT_AGENT_CONVAI_DEPLOY_MODE: AgentConvaiDeployMode = 'legacy';

export function isAgentConvaiDeployMode(value: unknown): value is AgentConvaiDeployMode {
  return typeof value === 'string' && (AGENT_CONVAI_DEPLOY_MODES as readonly string[]).includes(value);
}

export function normalizeAgentConvaiDeployMode(raw: unknown): AgentConvaiDeployMode {
  return isAgentConvaiDeployMode(raw) ? raw : DEFAULT_AGENT_CONVAI_DEPLOY_MODE;
}

export function isKbDeterministicDeployMode(mode: AgentConvaiDeployMode): boolean {
  return mode === 'kb_deterministic';
}

export const AGENT_CONVAI_DEPLOY_MODE_LABELS: Record<AgentConvaiDeployMode, string> = {
  legacy: 'Vai (classico)',
  kb_deterministic: 'Deploy deterministico',
};
