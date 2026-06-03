/**
 * Lessico slot a livello progetto: surface → slot_id, registro dinamico (nessun vocabolario statico).
 */

import type { SlotSurfaceMapping } from './schema';
import type { DynamicSlotBindingSource, DynamicSlotValueType } from './dynamicSlotRegistry';

export const LEXICON_SCHEMA_VERSION = 2 as const;

/** Placeholder quando la surface non ha ancora una categoria (ex `slot`). */
export const UNCLASSIFIED_SLOT_ID = 'undefined' as const;

/**
 * @deprecated Nessun vocabolario core: usare {@link listRegisteredSlotIds} sul lessico progetto.
 * Mantenuto vuoto per compatibilità import legacy.
 */
export const CORE_SLOT_IDS: readonly string[] = [];

/** True se la categoria non è stata assegnata (include legacy `slot`). */
export function isUnclassifiedSlotId(slotId: string): boolean {
  const s = slotId.trim().toLowerCase();
  return s === UNCLASSIFIED_SLOT_ID || s === 'slot';
}

/** Normalizza `slot_id` persistito (migra legacy `slot` → `undefined`). */
export function normalizeSlotId(slotId: string): string {
  const s = slotId.trim().toLowerCase();
  return s === 'slot' ? UNCLASSIFIED_SLOT_ID : s;
}

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
  /** Etichetta leggibile per il designer. */
  label?: string;
  valueType?: DynamicSlotValueType;
  description?: string;
  binding?: DynamicSlotBindingSource;
  /** Proposta IA in attesa di revisione. */
  proposedByAi?: boolean;
  /** Se true, la compile IA non sovrascrive label/descrizione/binding. */
  designerLocked?: boolean;
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
    slotRegistry: {},
  };
}

export function normalizeSurface(surface: string): string {
  return surface.trim().toLowerCase();
}

/** snake_case: lettere, cifre, underscore (no doppio underscore iniziale). */
export function isValidSlotId(slotId: string): boolean {
  const s = slotId.trim().toLowerCase();
  return /^[a-z][a-z0-9_]*$/.test(s) && !s.includes('__');
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
        const slot_id = normalizeSlotId(String(eo.slot_id ?? ''));
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
    const slotRegistry: Record<string, SlotRegistryEntry> = {};
    if (o.slotRegistry && typeof o.slotRegistry === 'object') {
      for (const [k, val] of Object.entries(o.slotRegistry as Record<string, unknown>)) {
        if (!val || typeof val !== 'object') continue;
        const vo = val as Record<string, unknown>;
        const linguisticVariants = Array.isArray(vo.linguisticVariants)
          ? vo.linguisticVariants.filter((x): x is string => typeof x === 'string')
          : undefined;
        const binding = parseBindingField(vo.binding);
        slotRegistry[k.toLowerCase()] = {
          ...(typeof vo.label === 'string' && vo.label.trim() ? { label: vo.label.trim() } : {}),
          ...(isValueType(vo.valueType) ? { valueType: vo.valueType } : {}),
          ...(typeof vo.description === 'string' ? { description: vo.description } : {}),
          ...(binding ? { binding } : {}),
          ...(vo.proposedByAi === true ? { proposedByAi: true } : {}),
          ...(vo.designerLocked === true ? { designerLocked: true } : {}),
          ...(linguisticVariants ? { linguisticVariants } : {}),
        };
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

export type MergeMappingsIntoLexiconOptions = {
  sourceTaskId?: string;
  /** Nuove voci create già approvate. */
  approve?: boolean;
  /**
   * Se la riga esiste con categoria `undefined` e la proposta è classificata,
   * aggiorna `slot_id` invece di segnare solo conflitto (es. post-IA compile).
   */
  upgradeUnclassified?: boolean;
  /** Dopo upgrade o stessa surface già classificata: marca approvata (proposta compile IA). */
  approveClassifiedProposals?: boolean;
};

/**
 * First-write-wins: nuove surface aggiunte; conflitto se stessa surface, slot_id diverso
 * (salvo upgrade da `undefined` quando `upgradeUnclassified`).
 */
export function mergeMappingsIntoLexicon(
  lexicon: ProjectSlotLexicon,
  mappings: readonly SlotSurfaceMapping[],
  options: MergeMappingsIntoLexiconOptions = {}
): MergeLexiconResult {
  const entries = [...lexicon.entries];
  const conflicts: MergeLexiconResult['conflicts'] = [];
  const bySurface = new Map(entries.map((e) => [e.surface, e]));

  for (const m of mappings) {
    if (m.localOnly) continue;
    const surface = normalizeSurface(m.surface);
    const slot_id = normalizeSlotId(m.slot_id);
    if (!surface || !isValidSlotId(slot_id)) continue;

    const existing = bySurface.get(surface);
    if (!existing) {
      const classified = !isUnclassifiedSlotId(slot_id);
      const entry: LexiconEntry = {
        surface,
        slot_id,
        approved:
          options.approve === true ||
          (options.approveClassifiedProposals === true && classified),
        ...(options.sourceTaskId ? { sourceTaskId: options.sourceTaskId } : {}),
      };
      entries.push(entry);
      bySurface.set(surface, entry);
      continue;
    }

    if (existing.slot_id === slot_id) {
      if (
        options.approveClassifiedProposals &&
        !isUnclassifiedSlotId(slot_id) &&
        !existing.approved
      ) {
        existing.approved = true;
      }
      continue;
    }

    const canUpgrade =
      options.upgradeUnclassified &&
      isUnclassifiedSlotId(existing.slot_id) &&
      !isUnclassifiedSlotId(slot_id);
    if (canUpgrade) {
      existing.slot_id = slot_id;
      existing.conflictWith = undefined;
      if (options.approveClassifiedProposals) {
        existing.approved = true;
      }
      continue;
    }

    conflicts.push({
      surface,
      existingSlotId: existing.slot_id,
      proposedSlotId: slot_id,
    });
    if (!existing.conflictWith) {
      existing.conflictWith = slot_id;
    }
  }

  return { lexicon: { ...lexicon, entries }, conflicts };
}

export interface PruneLexiconOrphansResult {
  lexicon: ProjectSlotLexicon;
  removedEntryCount: number;
  removedProposalCount: number;
}

/**
 * Rimuove dal lessico le surface non più presenti nel catalogo (UC cancellati o testo cambiato).
 */
export function pruneLexiconOrphans(
  lexicon: ProjectSlotLexicon,
  surfacesInCatalog: ReadonlySet<string>
): PruneLexiconOrphansResult {
  const entries = lexicon.entries.filter((e) => surfacesInCatalog.has(e.surface));
  const removedEntryCount = lexicon.entries.length - entries.length;

  const pendingRaw = lexicon.pendingProposals ?? [];
  const pendingProposals = pendingRaw.filter((p) =>
    surfacesInCatalog.has(normalizeSurface(p.surface))
  );
  const removedProposalCount = pendingRaw.length - pendingProposals.length;

  if (removedEntryCount === 0 && removedProposalCount === 0) {
    return { lexicon, removedEntryCount: 0, removedProposalCount: 0 };
  }

  return {
    lexicon: {
      ...lexicon,
      entries,
      ...(pendingProposals.length > 0 || pendingRaw.length > 0
        ? { pendingProposals }
        : {}),
    },
    removedEntryCount,
    removedProposalCount,
  };
}

export function lookupApprovedSlotId(
  lexicon: ProjectSlotLexicon,
  surface: string
): string | null {
  const key = normalizeSurface(surface);
  const hit = lexicon.entries.find((e) => e.surface === key && e.approved);
  return hit?.slot_id ?? null;
}

/** Riga lessico classificata (anche non approvata) — usata dopo proposta compile IA. */
export function lookupLexiconSlotId(
  lexicon: ProjectSlotLexicon,
  surface: string
): string | null {
  const key = normalizeSurface(surface);
  const hit = lexicon.entries.find((e) => e.surface === key);
  if (!hit || isUnclassifiedSlotId(hit.slot_id)) return null;
  return hit.slot_id;
}

function isValueType(v: unknown): v is DynamicSlotValueType {
  return (
    v === 'string' ||
    v === 'date' ||
    v === 'time' ||
    v === 'enum' ||
    v === 'number' ||
    v === 'boolean' ||
    v === 'list' ||
    v === 'unknown'
  );
}

function parseBindingField(raw: unknown): DynamicSlotBindingSource | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === 'dialog' && typeof o.path === 'string' && o.path.trim()) {
    return { kind: 'dialog', path: o.path.trim() };
  }
  if (kind === 'kb' && typeof o.path === 'string' && o.path.trim()) {
    return { kind: 'kb', path: o.path.trim() };
  }
  if (kind === 'backend_receive' && typeof o.apiPath === 'string' && o.apiPath.trim()) {
    return {
      kind: 'backend_receive',
      apiPath: o.apiPath.trim(),
      ...(typeof o.toolName === 'string' && o.toolName.trim()
        ? { toolName: o.toolName.trim() }
        : {}),
    };
  }
  if (kind === 'backend_send' && typeof o.sendPath === 'string' && o.sendPath.trim()) {
    return {
      kind: 'backend_send',
      sendPath: o.sendPath.trim(),
      ...(typeof o.toolName === 'string' && o.toolName.trim()
        ? { toolName: o.toolName.trim() }
        : {}),
    };
  }
  if (kind === 'unbound') return { kind: 'unbound' };
  return undefined;
}

export { listRegisteredSlotIds } from './dynamicSlotRegistry';
