/**
 * Use case marcato come Start: regola di apertura sessione e frase ConvAI `first_message`.
 */

import { buildUseCaseCatalogNumberById } from '@domain/aiAgentUseCase/useCaseCatalogNumber';
import {
  getAssistantExample,
  isUseCaseIncludedInConversations,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';
import { projectUseCaseToConversationalJson } from './useCaseJsonProjection';
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

/** Testo runtime (prima variante tokenizzata) per ElevenLabs `first_message`. */
export function resolveStartUseCaseSpeechText(
  useCases: readonly AIAgentUseCase[],
  startUseCaseId: string | undefined | null
): string {
  const uc = resolveStartUseCase(useCases, startUseCaseId);
  if (!uc) return '';
  const projected = projectUseCaseToConversationalJson(uc);
  const fromVariant = projected?.variants[0]?.tokenizedExample?.trim();
  if (fromVariant) return fromVariant;
  return getAssistantExample(uc).trim();
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
    speechTemplate: resolveStartUseCaseSpeechText(useCases, uc.id),
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
    `Stato iniziale obbligatorio della conversazione: applica **Use Case ${meta.catalogNumber}** («${meta.label}»).`,
    `Condizione: all'avvio della sessione, finché l'utente non ha ancora fornito contesto utile e non hai completato il turno 0.`,
    '',
    'Passi obbligatori (in ordine):',
    '1. Identifica che sei in **FASE START** (turno 0): nessun altro use case è ammesso.',
    `2. Se lo scenario o \`tokenBindings\` / \`slotBackendContract\` dell'Use Case ${meta.catalogNumber} richiedono dati dal backend, **invoca prima** i tool webhook indicati (\`toolName\`, SEND in tokenBindings); leggi RECEIVE (blocco BACKEND RECEIVE).`,
    '3. Compila **solo** i token `[…]` del template sotto; non lasciare parentesi quadre visibili; non aggiungere parole fuori dal template (Template-Only).',
    '4. Pronuncia la frase risultante come **unica** output del turno 0.',
    '5. Vietato: «Ciao», «Come posso aiutarti», «Hello», o qualsiasi saluto/frase non presente nel template Start.',
    scenarioLine,
    speechLine,
    '',
    'Dopo il turno 0 completato, passa alla selezione use case normale (regola 1 generale).',
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
    `Il campo \`first_message\` configurato sull'agente è il template dell'Use Case ${meta.catalogNumber} Start.`,
    'Alla connessione: trattala come **turno 0** — completa i token con backend/tool se necessario, poi pronuncia quella frase (o l\'equivalente già compilato).',
    'Non sostituire con saluti generici. Non passare ad altri use case prima di aver chiuso il turno 0.',
  ].join('\n');
}
