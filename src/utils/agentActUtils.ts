import { AgentActItem } from '../types/project';

/**
 * Restituisce tutti gli Agent Acts disponibili.
 * In futuro si potrà filtrare per blocco, categoria, ecc.
 */
export function getAllAgentActs(agentActs: AgentActItem[]): AgentActItem[] {
  return agentActs;
}

/**
 * Restituisce il prompt principale di un Agent Act (per ora il primo esempio)
 */
export function getAgentActPrompt(agentAct: AgentActItem): string {
  // @ts-ignore: examples non è ancora tipizzato in AgentActItem
  return Array.isArray(agentAct.examples) ? agentAct.examples[0] : '';
} 