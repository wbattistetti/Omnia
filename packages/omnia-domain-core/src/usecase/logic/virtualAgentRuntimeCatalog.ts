/**
 * Builds a runtime catalog and optional system-prompt appendix from AI Agent use cases
 * (motor JSON + assistant line). Used for compile-time rules and designer export.
 */

import { parseAgentUseCasesJson, type AIAgentUseCase } from '@types/aiAgentUseCases';
import type { AgentMessageMotorPayload, AgentMotorGroup, AgentMotorSlotBinding } from './splitAgentMessageTemplate';
import {
  buildUseCaseCatalogNumberById,
  formatUseCaseCatalogNumberLabel,
} from './useCaseCatalogNumber';

/** JSON shape matching motor slots/groups without segments (runtime contract). */
export interface VirtualAgentMotorContractJson {
  use_case_id: string;
  label: string;
  template: string;
  slots: AgentMotorSlotBinding[];
  groups?: AgentMotorGroup[];
}

export interface VirtualAgentCatalogEntry {
  /** Numero catalogo 1..N (ordine deploy / lista designer). */
  catalog_number: number;
  use_case_id: string;
  label: string;
  template: string;
  /** Empty surfaces / empty group values — structural schema only. */
  schema: VirtualAgentMotorContractJson;
  /** Same keys as `schema`, filled from design-time motor snapshot. */
  example_filled_output: VirtualAgentMotorContractJson;
  /** Annotated assistant example (linguistic guide). */
  assistant_example_line: string;
  /** Short scenario context when present (intent hint). */
  scenario_payoff?: string;
}

export interface VirtualAgentRuntimeCatalogBuildResult {
  entries: VirtualAgentCatalogEntry[];
  skipped: { use_case_id: string; reason: string }[];
}

export interface VirtualAgentPromptAppendixOptions {
  /** Optional global tone contract (e.g. cortese / formale). */
  globalStyleContract?: string;
}

const CATALOG_VERSION = 1 as const;

function emptySurfacesSlots(slots: AgentMotorSlotBinding[]): AgentMotorSlotBinding[] {
  return slots.map((s) => ({
    slot_id: s.slot_id,
    surface: '',
  }));
}

function emptyValuesGroups(groups: AgentMotorGroup[] | undefined): AgentMotorGroup[] | undefined {
  if (!groups?.length) return undefined;
  return groups.map((g) => ({
    slot_id: g.slot_id,
    values: [],
    ...(typeof g.pattern === 'string' && g.pattern.trim() ? { pattern: g.pattern.trim() } : {}),
    ...(g.separator !== undefined ? { separator: g.separator } : {}),
    ...(g.last_separator !== undefined ? { last_separator: g.last_separator } : {}),
    ...(typeof g.period === 'string' && g.period.trim() ? { period: g.period.trim() } : {}),
  }));
}

function isMotorPayload(x: unknown): x is AgentMessageMotorPayload {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return typeof o.template === 'string' && Array.isArray(o.slots);
}

function normalizeMotorForUseCase(uc: AIAgentUseCase, motor: AgentMessageMotorPayload): AgentMessageMotorPayload {
  const label = typeof uc.label === 'string' && uc.label.trim() ? uc.label.trim() : motor.label;
  return {
    ...motor,
    use_case_id: uc.id,
    label,
  };
}

function toContractJson(m: AgentMessageMotorPayload, slots: AgentMotorSlotBinding[], groups?: AgentMotorGroup[]): VirtualAgentMotorContractJson {
  return {
    use_case_id: m.use_case_id,
    label: m.label,
    template: m.template,
    slots,
    ...(groups?.length ? { groups } : {}),
  };
}

/**
 * Reads assistant turn + motor snapshot and produces one catalog row; skips when motor is missing.
 */
export function buildVirtualAgentCatalogEntry(
  uc: AIAgentUseCase,
  catalogNumber: number
): VirtualAgentCatalogEntry | null {
  const assistant = uc.dialogue.find((t) => t.role === 'assistant');
  if (!assistant) {
    return null;
  }
  const ms = assistant.motor_snapshot;
  const payload = ms?.payload;
  if (!payload || !isMotorPayload(payload)) {
    return null;
  }
  const motor = normalizeMotorForUseCase(uc, payload);
  const schemaSlots = emptySurfacesSlots(motor.slots);
  const schemaGroups = emptyValuesGroups(motor.groups);
  const filledSlots = motor.slots.map((s) => ({
    slot_id: s.slot_id,
    surface: s.surface,
  }));
  const filledGroups = motor.groups?.length
    ? motor.groups.map((g) => ({
        slot_id: g.slot_id,
        values: [...g.values],
        ...(typeof g.pattern === 'string' && g.pattern.trim() ? { pattern: g.pattern.trim() } : {}),
        ...(g.separator !== undefined ? { separator: g.separator } : {}),
        ...(g.last_separator !== undefined ? { last_separator: g.last_separator } : {}),
        ...(typeof g.period === 'string' && g.period.trim() ? { period: g.period.trim() } : {}),
      }))
    : undefined;

  const assistantLine = String(assistant.content ?? '').trim();
  const payoff = typeof uc.payoff === 'string' && uc.payoff.trim() ? uc.payoff.trim() : undefined;

  return {
    catalog_number: catalogNumber,
    use_case_id: uc.id,
    label: motor.label,
    template: motor.template,
    schema: toContractJson(motor, schemaSlots, schemaGroups),
    example_filled_output: toContractJson(motor, filledSlots, filledGroups),
    assistant_example_line: assistantLine,
    ...(payoff ? { scenario_payoff: payoff } : {}),
  };
}

/**
 * Builds ordered catalog entries from persisted use cases (requires Annotate JSON / motor snapshot per scenario).
 */
export function buildVirtualAgentRuntimeCatalogFromUseCases(
  useCases: readonly AIAgentUseCase[]
): VirtualAgentRuntimeCatalogBuildResult {
  const numberById = buildUseCaseCatalogNumberById(useCases);
  const sorted = [...useCases].sort(
    (a, b) => (numberById.get(a.id) ?? 0) - (numberById.get(b.id) ?? 0)
  );
  const entries: VirtualAgentCatalogEntry[] = [];
  const skipped: { use_case_id: string; reason: string }[] = [];

  for (const uc of sorted) {
    const row = buildVirtualAgentCatalogEntry(uc, numberById.get(uc.id) ?? 0);
    if (row) {
      entries.push(row);
    } else {
      skipped.push({
        use_case_id: uc.id,
        reason: 'missing_assistant_turn_or_motor_snapshot',
      });
    }
  }

  return { entries, skipped };
}

/**
 * Serializable bundle for export / ConvAI provisioning (no motor `segments`).
 */
export function serializeVirtualAgentRuntimeCatalog(result: VirtualAgentRuntimeCatalogBuildResult): string {
  return JSON.stringify(
    {
      catalog_version: CATALOG_VERSION,
      entries: result.entries,
      skipped: result.skipped,
    },
    null,
    2
  );
}

/**
 * System-prompt appendix: programmatic rules + per–use case schema, example line, filled JSON.
 */
export function buildVirtualAgentUseCaseConstrainedPromptAppendix(
  entries: readonly VirtualAgentCatalogEntry[],
  options?: VirtualAgentPromptAppendixOptions
): string {
  const style =
    typeof options?.globalStyleContract === 'string' && options.globalStyleContract.trim()
      ? `\n\n### Stile conversazionale globale\n\n${options.globalStyleContract.trim()}\n`
      : '';

  const head = `## Instructions per Prompt Rendering

### Obiettivo
L'agente virtuale deve riconoscere quale use case si applica alla frase dell'utente e produrre obbligatoriamente un output conforme al JSON e al template associati a quell'use case.

### Regole
- Usa solo il catalogo di use cases sotto.
- Ogni use case ha: id, label, template, JSON schema, frase di esempio e JSON compilato di esempio.
- Quando riconosci un use case:
  • Usa il JSON associato come unica struttura ammessa.
  • Segui il template e la frase di esempio come guida linguistica.
  • Riempi gli slot con i dati estratti dalla frase.
  • Non inventare slot o chiavi fuori dallo schema.
- Se nessun use case corrisponde, rispondi in modo libero (fallback).
- L'output verso l'utente è sempre testo naturale; il JSON è struttura interna.${style}

### Catalogo Use Cases

`;

  const blocks = entries.map((e) => {
    const numLabel = formatUseCaseCatalogNumberLabel(e.catalog_number);
    const payoffLine = e.scenario_payoff ? `\nContesto scenario (design): ${e.scenario_payoff}` : '';
    return `
### ${numLabel} — ${e.use_case_id}
Label: ${e.label}${payoffLine}
Log runtime (se abilitato): USECASE: "${e.catalog_number} — <NOME>"
Template (guida linguistica): ${e.template}

Schema JSON (struttura vincolante):
${JSON.stringify(e.schema, null, 2)}

Frase di esempio (linea assistente):
${e.assistant_example_line || '(vuoto)'}

JSON compilato di esempio:
${JSON.stringify(e.example_filled_output, null, 2)}
`.trim();
  });

  return [head.trimEnd(), ...blocks].join('\n\n');
}

/**
 * Appends the constrained-use-case appendix to compile/runtime rules when use cases JSON is present.
 */
export function appendVirtualAgentCatalogToRulesString(
  baseRules: string,
  agentUseCasesJson: string | undefined | null
): string {
  const raw = typeof agentUseCasesJson === 'string' ? agentUseCasesJson.trim() : '';
  if (!raw) {
    return baseRules;
  }

  const useCases = parseAgentUseCasesJson(raw);
  const result = buildVirtualAgentRuntimeCatalogFromUseCases(useCases);
  if (result.entries.length === 0) {
    return baseRules;
  }

  const appendix = buildVirtualAgentUseCaseConstrainedPromptAppendix(result.entries);
  const base = baseRules.trimEnd();
  const sep = '\n\n---\n\n';
  return base ? `${base}${sep}${appendix}` : appendix;
}
