/**
 * Use case marcato come Start: regola di apertura sessione e frase ConvAI `first_message`.
 */

import { buildUseCaseCatalogNumberById } from '@domain/aiAgentUseCase/useCaseCatalogNumber';
import {
  getAssistantExample,
  isUseCaseIncludedInConversations,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import { isStartAgentUseCase } from './agentStartPrompt';

/** Metadati use case Start per header prompt e allineamento ConvAI. */
export type StartUseCasePromptMeta = {
  useCaseId: string;
  catalogNumber: string;
  label: string;
  scenario: string;
  speechTemplate: string;
};

/** Risolve l'use case Start se l'id è valido, incluso nel catalogo e proiettabile. */
export function resolveStartUseCase(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): AIAgentUseCase | null {
  const id = String(startUseCaseId ?? '').trim();
  if (!id) return null;
  const uc = useCases.find((u) => u.id === id);
  if (!uc || isStartAgentUseCase(uc)) return null;
  if (!isUseCaseIncludedInConversations(uc)) return null;
  return uc;
}

/**
 * Frase di apertura statica per ConvAI `first_message` (testo naturale del designer).
 * Non usa `tokenizedExample`: gli slot si compilano dal turno 1 in poi.
 */
export function resolveStartUseCaseOpeningSpeechText(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): string {
  const uc = resolveStartUseCase(useCases, startUseCaseId);
  if (!uc) return '';
  return getAssistantExample(uc).trim();
}

/** @deprecated Prefer {@link resolveStartUseCaseOpeningSpeechText} for first_message; keeps natural opener for callers. */
export function resolveStartUseCaseSpeechText(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): string {
  return resolveStartUseCaseOpeningSpeechText(useCases, startUseCaseId);
}

/** Metadati Start se l'id è valido e l'UC è nel catalogo conversazionale. */
export function resolveStartUseCasePromptMeta(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): StartUseCasePromptMeta | null {
  const uc = resolveStartUseCase(useCases, startUseCaseId);
  if (!uc) return null;

  const included = useCases.filter(
    (u) => isUseCaseIncludedInConversations(u) && !isStartAgentUseCase(u)
  );
  const numberById = buildUseCaseCatalogNumberById(included);
  const n = numberById.get(uc.id);
  const catalogNumber = typeof n === 'number' && n > 0 ? String(n) : '?';

  return {
    useCaseId: uc.id,
    catalogNumber,
    label: String(uc.label ?? '').trim() || uc.id,
    scenario: String(uc.payoff ?? uc.refinement_prompt ?? '').trim(),
    speechTemplate: resolveStartUseCaseOpeningSpeechText(useCases, uc.id),
  };
}

/** Istruzione regola 1 quando esiste uno use case Start (turno 0 prioritario). */
export function buildStartTurnRuleOneOverrideIt(meta: StartUseCasePromptMeta): string {
  return (
    `1. **Turno 0 (apertura — FASE START, obbligatoria)**: prima di qualsiasi altra scelta, applica **solo** l'Use Case ${meta.catalogNumber} («${meta.label}», id \`${meta.useCaseId}\`) come definito in «Regola di Start» sotto. ` +
    `Questa regola **prevale** su ogni altra istruzione di selezione use case finché non hai completato il turno 0. ` +
    `Non usare saluti generici, non scegliere altri use case, non produrre testo libero. ` +
    `**Dal turno 1 in poi**, scegli un solo use case tra quelli applicabili (il più adatto al turno); usa una sola variante — il template indicato nel catalogo; rispetta \`when\` / \`WHEN:\` per la variante.`
  );
}

/**
 * Sezione «Regola di Start» nel system prompt. Vuota se nessun use case Start valido.
 */
export function buildStartUseCaseRuleSection(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): string {
  const meta = resolveStartUseCasePromptMeta(useCases, startUseCaseId);
  if (!meta) return '';

  const speechLine = meta.speechTemplate
    ? `\n\nFrase da pronunciare (template use case — deve coincidere con \`first_message\` su ElevenLabs):\n> ${meta.speechTemplate.replace(/\n/g, '\n> ')}`
    : '';

  const scenarioLine = meta.scenario
    ? `\n\nScenario UC Start (se indica backend/tool): ${meta.scenario}`
    : '';

  const lines = [
    'Regola di Start — FASE START (turno 0)',
    `All'avvio sessione pronuncia **subito** la frase statica di apertura (Use Case ${meta.catalogNumber} «${meta.label}»), allineata a \`first_message\` su ElevenLabs.`,
    'Non attendere slot, backend o compilazione token per parlare al turno 0.',
    '',
    'Passi obbligatori (in ordine):',
    '1. **Turno 0**: pronuncia la frase di apertura statica sotto; nessun altro use case.',
    '2. **Attendi** la risposta dell\'utente.',
    '3. **Dal turno 1**: slot filling, tool backend e selezione use case come da catalogo e regole generali.',
    '4. Vietato al turno 0: saluti generici diversi dalla frase configurata («Ciao», «Come posso aiutarti», …).',
    scenarioLine,
    speechLine,
    '',
    'Dopo la prima risposta utente, passa alla selezione use case normale (regola 1 generale).',
  ];
  return lines.join('\n').trim();
}

/** Append al prompt ConvAI (allineamento `first_message` ElevenLabs). */
export function buildElevenLabsStartPhaseAppend(
  meta: StartUseCasePromptMeta | null,
  options?: { agentImmediateStart?: boolean }
): string {
  if (!meta || options?.agentImmediateStart === true) return '';
  return [
    '---',
    'ElevenLabs — FASE START e first_message',
    `Il campo \`first_message\` è la frase statica dell'Use Case ${meta.catalogNumber} Start — pronunciala **subito** alla connessione.`,
    'Non compilare slot al turno 0. Dopo la risposta utente: slot filling e use case successivi.',
    'Non sostituire con saluti generici.',
  ].join('\n');
}
