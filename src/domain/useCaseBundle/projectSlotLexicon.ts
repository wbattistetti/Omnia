/**
 * Lessico slot a livello progetto: surface → slot_id, registry tipi e varianti linguistiche.
 */

import type { SlotSurfaceMapping } from './schema';

export const LEXICON_SCHEMA_VERSION = 1 as const;

/** Vocabolario chiuso iniziale (estendibile con approvazione designer). */
export const CORE_SLOT_IDS = [
  'prestazione',
  'data',
  'datarelativa',
  'orario',
  'giornosettimana',
  'numerogiorno',
  'mese',
  'formulaconferma',
  'nome',
  'email',
  'telefono',
  'importo',
  'slot',
] as const;

export type CoreSlotId = (typeof CORE_SLOT_IDS)[number];

export interface LexiconEntry {
  surface: string;
  slot_id: string;
  approved: boolean;
  sourceTaskId?: string;
  /** Altro slot_id già registrato per la stessa surface (first-write-wins). */
  conflictWith?: string;
}

export interface SlotRegistryEntry {
  linguisticVariants?: string[];
}

export interface ProjectSlotLexicon {
  lexiconSchemaVersion: typeof LEXICON_SCHEMA_VERSION;
  entries: LexiconEntry[];
  slotRegistry: Record<string, SlotRegistryEntry>;
  /** Proposte AI in attesa di approvazione. */
  pendingProposals?: Array<{
    surface: string;
    slot_id: string;
    sourceTaskId?: string;
    proposedAt: string;
  }>;
}

export function emptyProjectSlotLexicon(): ProjectSlotLexicon {
  return {
    lexiconSchemaVersion: LEXICON_SCHEMA_VERSION,
    entries: [],
    slotRegistry: {
      formulaconferma: {
        linguisticVariants: ['va bene', 'giusto', 'corretto', 'perfetto'],
      },
    },
  };
}

export function normalizeSurface(surface: string): string {
  return surface.trim().toLowerCase();
}

export function isValidSlotId(slotId: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(slotId);
}

export function parseProjectSlotLexiconJson(raw: string | undefined | null): ProjectSlotLexicon {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return emptyProjectSlotLexicon();
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return emptyProjectSlotLexicon();
    const o = v as Record<string, unknown>;
    const entries: LexiconEntry[] = [];
    if (Array.isArray(o.entries)) {
      for (const e of o.entries) {
        if (!e || typeof e !== 'object') continue;
        const eo = e as Record<string, unknown>;
        const surface = normalizeSurface(String(eo.surface ?? ''));
        const slot_id = String(eo.slot_id ?? '').trim().toLowerCase();
        if (!surface || !isValidSlotId(slot_id)) continue;
        entries.push({
          surface,
          slot_id,
          approved: eo.approved === true,
          ...(typeof eo.sourceTaskId === 'string' ? { sourceTaskId: eo.sourceTaskId } : {}),
          ...(typeof eo.conflictWith === 'string' ? { conflictWith: eo.conflictWith } : {}),
        });
      }
    }
    const slotRegistry: Record<string, SlotRegistryEntry> = {
      ...emptyProjectSlotLexicon().slotRegistry,
    };
    if (o.slotRegistry && typeof o.slotRegistry === 'object') {
      for (const [k, val] of Object.entries(o.slotRegistry as Record<string, unknown>)) {
        if (!val || typeof val !== 'object') continue;
        const vo = val as Record<string, unknown>;
        const linguisticVariants = Array.isArray(vo.linguisticVariants)
          ? vo.linguisticVariants.filter((x): x is string => typeof x === 'string')
          : undefined;
        slotRegistry[k.toLowerCase()] = { ...(linguisticVariants ? { linguisticVariants } : {}) };
      }
    }
    return {
      lexiconSchemaVersion: LEXICON_SCHEMA_VERSION,
      entries,
      slotRegistry,
      ...(Array.isArray(o.pendingProposals) ? { pendingProposals: o.pendingProposals as ProjectSlotLexicon['pendingProposals'] } : {}),
    };
  } catch {
    return emptyProjectSlotLexicon();
  }
}

export function serializeProjectSlotLexicon(lexicon: ProjectSlotLexicon): string {
  return JSON.stringify(lexicon);
}

export interface MergeLexiconResult {
  lexicon: ProjectSlotLexicon;
  conflicts: Array<{ surface: string; existingSlotId: string; proposedSlotId: string }>;
}

/**
 * First-write-wins: nuove surface aggiunte; conflitto se stessa surface, slot_id diverso.
 */
export function mergeMappingsIntoLexicon(
  lexicon: ProjectSlotLexicon,
  mappings: readonly SlotSurfaceMapping[],
  options: { sourceTaskId?: string; approve?: boolean } = {}
): MergeLexiconResult {
  const entries = [...lexicon.entries];
  const conflicts: MergeLexiconResult['conflicts'] = [];
  const bySurface = new Map(entries.map((e) => [e.surface, e]));

  for (const m of mappings) {
    if (m.localOnly) continue;
    const surface = normalizeSurface(m.surface);
    const slot_id = m.slot_id.trim().toLowerCase();
    if (!surface || !isValidSlotId(slot_id)) continue;

    const existing = bySurface.get(surface);
    if (!existing) {
      const entry: LexiconEntry = {
        surface,
        slot_id,
        approved: options.approve === true,
        ...(options.sourceTaskId ? { sourceTaskId: options.sourceTaskId } : {}),
      };
      entries.push(entry);
      bySurface.set(surface, entry);
      continue;
    }
    if (existing.slot_id !== slot_id) {
      conflicts.push({
        surface,
        existingSlotId: existing.slot_id,
        proposedSlotId: slot_id,
      });
      if (!existing.conflictWith) {
        existing.conflictWith = slot_id;
      }
    }
  }

  return { lexicon: { ...lexicon, entries }, conflicts };
}

export function lookupApprovedSlotId(
  lexicon: ProjectSlotLexicon,
  surface: string
): string | null {
  const key = normalizeSurface(surface);
  const hit = lexicon.entries.find((e) => e.surface === key && e.approved);
  return hit?.slot_id ?? null;
}
