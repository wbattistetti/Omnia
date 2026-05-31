/**
 * Start Prompt (scenario `startAgent`): frase di apertura sessione, separata dal catalogo use case.
 */

import {
  projectAllUseCasesToConversationalJson,
  type UseCaseConversationalJson,
} from './useCaseJsonProjection';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { isUseCaseIncludedInConversations } from '@types/aiAgentUseCases';

/** Id logico scenario apertura (non compare nella lista numerata use case). */
export const START_AGENT_SCENARIO_ID = 'startAgent';

export type AgentStartPromptVariant = {
  id: string;
  /** Condizione opzionale (es. fascia oraria, canale). */
  when?: string;
  text: string;
};

export type AgentStartPromptConfig = {
  schemaVersion: 1;
  /** Frase principale pronunciata all'avvio sessione. */
  text: string;
  variants?: AgentStartPromptVariant[];
};

export function emptyAgentStartPromptConfig(): AgentStartPromptConfig {
  return { schemaVersion: 1, text: '', variants: [] };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function parseVariants(raw: unknown): AgentStartPromptVariant[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentStartPromptVariant[] = [];
  for (const row of raw) {
    if (!isRecord(row)) continue;
    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id.trim()
        : `v_${out.length + 1}`;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!text) continue;
    const when = typeof row.when === 'string' && row.when.trim() ? row.when.trim() : undefined;
    out.push({ id, text, ...(when ? { when } : {}) });
  }
  return out;
}

/** Legge `agentStartPromptJson` dal task (tollerante a assenza / legacy). */
export function parseAgentStartPromptJson(raw: string | undefined | null): AgentStartPromptConfig {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return emptyAgentStartPromptConfig();
  try {
    const v = JSON.parse(trimmed) as unknown;
    if (!isRecord(v)) return emptyAgentStartPromptConfig();
    const text = typeof v.text === 'string' ? v.text : '';
    const variants = parseVariants(v.variants);
    return {
      schemaVersion: 1,
      text,
      ...(variants.length > 0 ? { variants } : {}),
    };
  } catch {
    return { schemaVersion: 1, text: trimmed, variants: [] };
  }
}

export function serializeAgentStartPromptConfig(config: AgentStartPromptConfig): string {
  const text = String(config.text ?? '').trim();
  const variants = (config.variants ?? []).filter((v) => v.text.trim());
  if (!text && variants.length === 0) return '';
  return JSON.stringify({
    schemaVersion: 1,
    text,
    ...(variants.length > 0 ? { variants } : {}),
  });
}

/** True se lo use case è lo scenario startAgent (da escludere dal catalogo business). */
export function isStartAgentUseCase(uc: Pick<AIAgentUseCase, 'id'>): boolean {
  return String(uc.id ?? '').trim() === START_AGENT_SCENARIO_ID;
}

/** Testo effettivo per ConvAI `first_message` / runtime (prima variante con when, altrimenti principale). */
export function resolveAgentStartPromptSpeechText(config: AgentStartPromptConfig): string {
  const main = String(config.text ?? '').trim();
  const variants = config.variants ?? [];
  if (variants.length === 0) return main;
  const lines = [main, ...variants.map((v) => {
    const when = v.when?.trim();
    return when ? `WHEN ${when}: ${v.text.trim()}` : v.text.trim();
  })].filter(Boolean);
  return lines.join('\n');
}

/**
 * Sezione prompt per il motore esterno (prima del catalogo use case).
 */
export function buildStartAgentPromptSection(config: AgentStartPromptConfig): string {
  const speech = resolveAgentStartPromptSpeechText(config);
  if (!speech.trim()) return '';
  const lines = [
    'Start sessione (startAgent)',
    'All\'avvio della conversazione pronuncia esclusivamente il testo sotto (scenario startAgent).',
    'Non applicare un use case del catalogo finché l\'utente non ha parlato.',
    '',
    `> ${speech.replace(/\n/g, '\n> ')}`,
  ];
  return lines.join('\n');
}

export type AgentPromptCatalogExport = {
  startUseCaseId?: string;
  useCases: UseCaseConversationalJson[];
};

/** JSON di configurazione agente per export / anteprima (`startUseCaseId` + `useCases`). */
export function buildAgentPromptCatalogExport(
  useCases: readonly AIAgentUseCase[],
  options: { includeLog?: boolean; startUseCaseId?: string } = {}
): AgentPromptCatalogExport {
  const businessCases = useCases.filter(
    (uc) => isUseCaseIncludedInConversations(uc) && !isStartAgentUseCase(uc)
  );
  const projected = projectAllUseCasesToConversationalJson(businessCases, options);
  const startId = String(options.startUseCaseId ?? '').trim();
  return {
    ...(startId ? { startUseCaseId: startId } : {}),
    useCases: projected,
  };
}
