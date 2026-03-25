/**
 * Serialization of per-section revision state for TaskRepository persistence.
 */

import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { AGENT_STRUCTURED_SECTION_IDS } from './agentStructuredSectionIds';
import {
  DEFAULT_CONSTRAINTS_SECTION_TEXT,
  DEFAULT_PERSONALITY_SECTION_TEXT,
  DEFAULT_TONE_SECTION_TEXT,
} from './agentStructuredSectionDefaults';
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

function extractSnapshotPlainText(row: unknown): string {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  const r = row as Record<string, unknown>;
  if (r.version === 2) {
    return typeof r.currentText === 'string' ? r.currentText : '';
  }
  if (typeof r.base === 'string') return r.base;
  return '';
}

/**
 * When no persisted structured JSON exists, map legacy flat agentPrompt into goal;
 * seed other sections with templates.
 */
export function migrateLegacyAgentPromptToPersisted(agentPrompt: string): PersistedStructuredSections {
  const main = agentPrompt.trim();
  const baseMain = main.length > 0 ? main : LEGACY_PLACEHOLDER;
  const out = {} as PersistedStructuredSections;
  for (const id of AGENT_STRUCTURED_SECTION_IDS) {
    if (id === 'goal') {
      out[id] = emptySnapshot(baseMain);
    } else if (id === 'context') {
      out[id] = emptySnapshot('');
    } else if (id === 'constraints') {
      out[id] = emptySnapshot(DEFAULT_CONSTRAINTS_SECTION_TEXT);
    } else if (id === 'personality') {
      out[id] = emptySnapshot(DEFAULT_PERSONALITY_SECTION_TEXT);
    } else if (id === 'tone') {
      out[id] = emptySnapshot(DEFAULT_TONE_SECTION_TEXT);
    } else {
      out[id] = emptySnapshot(LEGACY_PLACEHOLDER);
    }
  }
  return out;
}

/** Strips leading Tone: line from legacy combined personality block. */
function stripLeadingToneBlock(text: string): string {
  const lines = String(text).split(/\r?\n/);
  const first = lines[0]?.trim() ?? '';
  if (/^Tone:\s*[a-z0-9_]+\s*$/i.test(first)) {
    return lines.slice(1).join('\n').trim();
  }
  return text.trim();
}

/**
 * Renames legacy section keys and merges into the 6-section layout (goal → tone).
 */
function migratePersistedStructuredSectionsRoot(parsed: Record<string, unknown>): Record<string, unknown> {
  const hasV6 =
    'goal' in parsed &&
    'tone' in parsed &&
    'context' in parsed &&
    'constraints' in parsed &&
    'operational_sequence' in parsed &&
    'personality' in parsed;
  if (hasV6) {
    const p = { ...parsed };
    delete p.task_scope;
    delete p.behavior_spec;
    delete p.positive_constraints;
    delete p.negative_constraints;
    delete p.constraints_must;
    delete p.constraints_forbidden;
    delete p.correction_rules;
    delete p.conversational_state;
    return p;
  }

  const goalText =
    extractSnapshotPlainText(parsed.goal) ||
    extractSnapshotPlainText(parsed.task_scope) ||
    extractSnapshotPlainText(parsed.behavior_spec) ||
    LEGACY_PLACEHOLDER;

  let opText = extractSnapshotPlainText(parsed.operational_sequence);
  const corrText = extractSnapshotPlainText(parsed.correction_rules);
  if (corrText) {
    opText = opText
      ? `${opText}\n\n---\n\nCorrections / recovery:\n${corrText}`
      : `Corrections / recovery:\n${corrText}`;
  }
  if (!opText) opText = LEGACY_PLACEHOLDER;

  const ctxText =
    extractSnapshotPlainText(parsed.context) || extractSnapshotPlainText(parsed.conversational_state) || '';

  let consText = extractSnapshotPlainText(parsed.constraints);
  if (!consText) {
    const must = extractSnapshotPlainText(parsed.constraints_must);
    const not = extractSnapshotPlainText(parsed.constraints_forbidden);
    if (must || not) {
      consText = `Must:\n\n${must || LEGACY_PLACEHOLDER}\n\nMust not:\n\n${not || LEGACY_PLACEHOLDER}`;
    } else {
      consText = DEFAULT_CONSTRAINTS_SECTION_TEXT;
    }
  }

  let persText = extractSnapshotPlainText(parsed.personality);
  let toneText = extractSnapshotPlainText(parsed.tone);

  if (!toneText && persText) {
    const firstLine = persText.split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() ?? '';
    if (/^Tone:\s*[a-z0-9_]+\s*$/i.test(firstLine)) {
      toneText = persText.trim();
      persText = stripLeadingToneBlock(persText) || DEFAULT_PERSONALITY_SECTION_TEXT;
    } else {
      toneText = DEFAULT_TONE_SECTION_TEXT;
    }
  }
  if (!persText) persText = DEFAULT_PERSONALITY_SECTION_TEXT;
  if (!toneText) toneText = DEFAULT_TONE_SECTION_TEXT;

  return {
    goal: emptySnapshot(goalText),
    operational_sequence: emptySnapshot(opText),
    context: emptySnapshot(ctxText),
    constraints: emptySnapshot(consText),
    personality: emptySnapshot(persText),
    tone: emptySnapshot(toneText),
  };
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
    const parsed = migratePersistedStructuredSectionsRoot(JSON.parse(raw) as Record<string, unknown>);
    const out = {} as PersistedStructuredSections;
    for (const id of AGENT_STRUCTURED_SECTION_IDS) {
      const row = parsed[id];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        if (id === 'context') {
          out[id] = emptySnapshot('');
        } else if (id === 'personality') {
          out[id] = emptySnapshot(DEFAULT_PERSONALITY_SECTION_TEXT);
        } else if (id === 'tone') {
          out[id] = emptySnapshot(DEFAULT_TONE_SECTION_TEXT);
        } else if (id === 'constraints') {
          out[id] = emptySnapshot(DEFAULT_CONSTRAINTS_SECTION_TEXT);
        } else {
          out[id] = emptySnapshot(LEGACY_PLACEHOLDER);
        }
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
