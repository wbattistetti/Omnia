/**
 * Serialization of per-section revision state for TaskRepository persistence.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import type { InsertOp } from './effectiveFromRevisionMask';

export interface PersistedSectionSnapshot {
  base: string;
  deletedMask: boolean[];
  inserts: InsertOp[];
}

export type PersistedStructuredSections = Record<AgentStructuredSectionId, PersistedSectionSnapshot>;

const LEGACY_PLACEHOLDER =
  '(Contenuto da definire — usa Refine comportamento o rigenera le sezioni.)';

function emptySnapshot(base: string): PersistedSectionSnapshot {
  return {
    base,
    deletedMask: new Array(Math.max(0, base.length)).fill(false),
    inserts: [],
  };
}

/**
 * When no persisted structured JSON exists, map legacy flat agentPrompt into behavior_spec only.
 */
export function migrateLegacyAgentPromptToPersisted(agentPrompt: string): PersistedStructuredSections {
  const main = agentPrompt.trim();
  const baseMain = main.length > 0 ? main : LEGACY_PLACEHOLDER;
  const out = {} as PersistedStructuredSections;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    if (id === 'behavior_spec') {
      out[id] = emptySnapshot(baseMain);
    } else if (id === 'conversational_state') {
      out[id] = emptySnapshot('');
    } else {
      out[id] = emptySnapshot(LEGACY_PLACEHOLDER);
    }
  }
  return out;
}

/**
 * Parses JSON from task field; on failure returns legacy migration from agentPrompt.
 */
export function parsePersistedStructuredSectionsJson(
  raw: unknown,
  fallbackAgentPrompt: string
): PersistedStructuredSections {
  if (typeof raw !== 'string' || !raw.trim()) {
    return migrateLegacyAgentPromptToPersisted(fallbackAgentPrompt);
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = {} as PersistedStructuredSections;
    for (const id of AGENT_STRUCTURED_SECTION_IDS) {
      const row = parsed[id];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        out[id] = emptySnapshot(id === 'conversational_state' ? '' : LEGACY_PLACEHOLDER);
        continue;
      }
      const r = row as Record<string, unknown>;
      const base = typeof r.base === 'string' ? r.base : '';
      const dm = Array.isArray(r.deletedMask)
        ? (r.deletedMask as unknown[]).map((x) => Boolean(x))
        : new Array(Math.max(0, base.length)).fill(false);
      const insertsRaw = Array.isArray(r.inserts) ? r.inserts : [];
      const inserts: InsertOp[] = [];
      for (const it of insertsRaw) {
        if (!it || typeof it !== 'object') continue;
        const o = it as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.text !== 'string') continue;
        const position = typeof o.position === 'number' && Number.isFinite(o.position) ? o.position : 0;
        inserts.push({ id: o.id, position, text: o.text });
      }
      while (dm.length < base.length) dm.push(false);
      if (dm.length > base.length) dm.length = base.length;
      out[id] = { base, deletedMask: dm, inserts };
    }
    return out;
  } catch {
    return migrateLegacyAgentPromptToPersisted(fallbackAgentPrompt);
  }
}

export function serializePersistedStructuredSections(p: PersistedStructuredSections): string {
  return JSON.stringify(p);
}

/**
 * After IA returns clean section bodies, each section starts with no user revisions.
 */
export function persistedFromCleanSectionBases(
  bases: Record<AgentStructuredSectionId, string>
): PersistedStructuredSections {
  const out = {} as PersistedStructuredSections;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    const base = bases[id] ?? '';
    out[id] = {
      base,
      deletedMask: new Array(Math.max(0, base.length)).fill(false),
      inserts: [],
    };
  }
  return out;
}
