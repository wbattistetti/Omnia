/**
 * Serialization of per-section revision state for TaskRepository persistence.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import type { InsertOp } from './effectiveFromRevisionMask';
import type { OtOp } from './otTypes';
import { applyOperations } from './otTextDocument';

/** Legacy v1 snapshot (mask + inserts on IA base). */
export interface PersistedSectionSnapshotV1 {
  base: string;
  deletedMask: boolean[];
  inserts: InsertOp[];
}

/** OT snapshot: canonical op log + materialized body (UTF-16). */
export interface PersistedSectionSnapshotV2 {
  version: 2;
  revisionBase: string;
  opLog: OtOp[];
  currentText: string;
}

export type PersistedSectionSnapshot = PersistedSectionSnapshotV1 | PersistedSectionSnapshotV2;

export type PersistedStructuredSections = Record<AgentStructuredSectionId, PersistedSectionSnapshot>;

const LEGACY_PLACEHOLDER =
  '(Contenuto da definire — usa Refine comportamento o rigenera le sezioni.)';

function emptySnapshot(base: string): PersistedSectionSnapshotV1 {
  return {
    base,
    deletedMask: new Array(Math.max(0, base.length)).fill(false),
    inserts: [],
  };
}

function parseOtOpLog(raw: unknown): OtOp[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: OtOp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (o.type === 'delete') {
      const start = typeof o.start === 'number' && Number.isFinite(o.start) ? o.start : 0;
      const end = typeof o.end === 'number' && Number.isFinite(o.end) ? o.end : 0;
      out.push({ type: 'delete', start, end });
    } else if (o.type === 'insert') {
      const position =
        typeof o.position === 'number' && Number.isFinite(o.position) ? o.position : 0;
      const text = typeof o.text === 'string' ? o.text : '';
      out.push({ type: 'insert', position, text });
    }
  }
  return out;
}

function normalizeV2Snapshot(row: PersistedSectionSnapshotV2): PersistedSectionSnapshotV2 {
  const revisionBase = row.revisionBase;
  const opLog = row.opLog;
  const currentText = applyOperations(revisionBase, opLog);
  return { version: 2, revisionBase, opLog, currentText };
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
      if (r.version === 2) {
        const revisionBase = typeof r.revisionBase === 'string' ? r.revisionBase : '';
        const currentTextRaw = typeof r.currentText === 'string' ? r.currentText : '';
        const opLog = parseOtOpLog(r.opLog);
        out[id] = normalizeV2Snapshot({
          version: 2,
          revisionBase,
          opLog,
          currentText: currentTextRaw,
        });
        continue;
      }

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
 * @param structuredOt — when true, persists v2 OT snapshots (empty op log).
 */
export function persistedFromCleanSectionBases(
  bases: Record<AgentStructuredSectionId, string>,
  options?: { structuredOt?: boolean }
): PersistedStructuredSections {
  const structuredOt = options?.structuredOt === true;
  const out = {} as PersistedStructuredSections;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    const base = bases[id] ?? '';
    if (structuredOt) {
      out[id] = { version: 2, revisionBase: base, opLog: [], currentText: base };
    } else {
      out[id] = {
        base,
        deletedMask: new Array(Math.max(0, base.length)).fill(false),
        inserts: [],
      };
    }
  }
  return out;
}
