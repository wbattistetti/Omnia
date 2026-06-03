/**
 * Registro slot dinamico per progetto: nessun vocabolario statico; definizioni create da IA/designer.
 */

import type { ProjectSlotLexicon, SlotRegistryEntry } from './projectSlotLexicon';
import { isUnclassifiedSlotId, isValidSlotId, normalizeSlotId } from './projectSlotLexicon';

export type DynamicSlotValueType =
  | 'string'
  | 'date'
  | 'time'
  | 'enum'
  | 'number'
  | 'boolean'
  | 'list'
  | 'unknown';

/** Origine del valore runtime per uno slot. */
export type DynamicSlotBindingSource =
  | { kind: 'dialog'; path: string }
  | { kind: 'kb'; path: string }
  | { kind: 'backend_receive'; apiPath: string; toolName?: string }
  | { kind: 'backend_send'; sendPath: string; toolName?: string }
  | { kind: 'unbound' };

export interface DynamicSlotDefinition {
  slotId: string;
  label?: string;
  valueType: DynamicSlotValueType;
  description: string;
  binding: DynamicSlotBindingSource;
  /** Proposta IA non ancora confermata dal designer. */
  proposedByAi?: boolean;
}

export function bindingSummary(binding: DynamicSlotBindingSource): string {
  switch (binding.kind) {
    case 'dialog':
      return `dialog:${binding.path}`;
    case 'kb':
      return `kb:${binding.path}`;
    case 'backend_receive':
      return binding.toolName
        ? `${binding.toolName} ← ${binding.apiPath}`
        : `receive:${binding.apiPath}`;
    case 'backend_send':
      return binding.toolName
        ? `${binding.toolName} → ${binding.sendPath}`
        : `send:${binding.sendPath}`;
    default:
      return '—';
  }
}

export function slotBindingStatus(
  def: DynamicSlotDefinition | undefined
): 'ok' | 'missing' | 'ambiguous' {
  if (!def) return 'missing';
  if (def.binding.kind === 'unbound') return 'missing';
  return 'ok';
}

/** Slot_id noti: registry + voci lessico classificate. */
export function listRegisteredSlotIds(lexicon: ProjectSlotLexicon): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of Object.keys(lexicon.slotRegistry ?? {})) {
    const norm = normalizeSlotId(id);
    if (!norm || isUnclassifiedSlotId(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  for (const e of lexicon.entries) {
    const norm = normalizeSlotId(e.slot_id);
    if (!norm || isUnclassifiedSlotId(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function getSlotDefinition(
  lexicon: ProjectSlotLexicon,
  slotId: string
): DynamicSlotDefinition | undefined {
  const id = normalizeSlotId(slotId);
  if (!id || isUnclassifiedSlotId(id)) return undefined;
  const entry = lexicon.slotRegistry?.[id];
  if (!entry) return undefined;
  return slotRegistryEntryToDefinition(id, entry);
}

function slotRegistryEntryToDefinition(
  slotId: string,
  entry: SlotRegistryEntry
): DynamicSlotDefinition {
  return {
    slotId,
    label: entry.label,
    valueType: entry.valueType ?? 'unknown',
    description: entry.description ?? '',
    binding: entry.binding ?? { kind: 'unbound' },
    proposedByAi: entry.proposedByAi,
  };
}

export function listSlotDefinitions(lexicon: ProjectSlotLexicon): DynamicSlotDefinition[] {
  return listRegisteredSlotIds(lexicon)
    .map((id) => getSlotDefinition(lexicon, id))
    .filter((d): d is DynamicSlotDefinition => Boolean(d));
}

export type MergeSlotDefinitionInput = {
  slotId: string;
  label?: string;
  valueType?: DynamicSlotValueType;
  description?: string;
  binding?: DynamicSlotBindingSource;
  proposedByAi?: boolean;
};

/**
 * Aggiorna `slotRegistry` con definizioni IA/designer (non sovrascrive voci approvate esplicitamente).
 */
export function mergeSlotDefinitionsIntoLexicon(
  lexicon: ProjectSlotLexicon,
  definitions: readonly MergeSlotDefinitionInput[],
  options: { overwriteProposedOnly?: boolean } = {}
): ProjectSlotLexicon {
  const registry = { ...(lexicon.slotRegistry ?? {}) };
  for (const def of definitions) {
    const slotId = normalizeSlotId(def.slotId);
    if (!isValidSlotId(slotId) || isUnclassifiedSlotId(slotId)) continue;
    const prev = registry[slotId];
    if (prev?.designerLocked && options.overwriteProposedOnly !== false) continue;
    registry[slotId] = {
      ...prev,
      ...(def.label ? { label: def.label } : {}),
      ...(def.valueType ? { valueType: def.valueType } : {}),
      ...(def.description ? { description: def.description } : {}),
      ...(def.binding ? { binding: def.binding } : {}),
      proposedByAi: def.proposedByAi ?? prev?.proposedByAi,
      designerLocked: prev?.designerLocked,
      linguisticVariants: prev?.linguisticVariants,
    };
  }
  return { ...lexicon, slotRegistry: registry };
}

/**
 * Aggiornamento esplicito designer su `slotRegistry` (descrizione/label per il motore runtime).
 */
export function upsertDesignerSlotRegistryEntry(
  lexicon: ProjectSlotLexicon,
  slotId: string,
  patch: { description?: string; label?: string }
): ProjectSlotLexicon {
  const id = normalizeSlotId(slotId);
  if (!isValidSlotId(id) || isUnclassifiedSlotId(id)) return lexicon;
  const registry = { ...(lexicon.slotRegistry ?? {}) };
  const prev = registry[id] ?? {};
  const next: SlotRegistryEntry = {
    ...prev,
    designerLocked: true,
    proposedByAi: false,
  };
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (label) next.label = label;
    else delete next.label;
  }
  if (patch.description !== undefined) {
    next.description = patch.description.trim();
  }
  registry[id] = next;
  return { ...lexicon, slotRegistry: registry };
}

/**
 * Sezione prompt: glossario slot_id → descrizione ruolo (per compile template a runtime).
 */
export function buildSlotLexiconGlossaryPromptSection(lexicon: ProjectSlotLexicon): string {
  const defs = listSlotDefinitions(lexicon).filter((d) => d.description.trim().length > 0);
  if (defs.length === 0) return '';
  const lines = defs
    .sort((a, b) => a.slotId.localeCompare(b.slotId))
    .map((d) => `- \`${d.slotId}\`: ${d.description.trim()}`);
  return [
    'Dizionario token semantici',
    'Ogni placeholder `[slot_id]` nel catalogo ha il ruolo sotto. Sostituisci il token con un valore coerente con la descrizione (non citare il nome tecnico dello slot all\'utente).',
    ...lines,
  ].join('\n');
}
