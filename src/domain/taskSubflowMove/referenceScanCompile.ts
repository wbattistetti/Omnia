/**
 * Compiles UI-facing copy (mustache, bracket DSL, nested task fields) into a GUID-only string
 * persisted as Task.referenceScanInternalText. Used on editor close / project save — not during reference scan.
 */

import type { VariableInstance } from '@types/variableTypes';
import { convertDSLLabelsToGUIDs } from '@utils/conditionCodeConverter';
import { REFERENCE_SCAN_INTERNAL_TEXT_KEY } from './internalReferenceHaystack';

const UUID_IN_TEXT =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/;

const MAX_COMPILE_CHUNKS = 6000;
const MAX_DEPTH = 48;

export function buildVariableGuidToVarNameMap(variables: VariableInstance[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const v of variables) {
    const id = String(v.id || '').trim();
    const name = String(v.varName || '').trim();
    if (id && name) m.set(id, name);
  }
  return m;
}

function normalizeLabelKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

type LabelIndex = {
  exact: Map<string, string>;
  lastSegment: Map<string, string>;
};

function buildLabelToVarIdIndex(variables: VariableInstance[]): LabelIndex {
  const exact = new Map<string, string>();
  const lastSegment = new Map<string, string>();
  for (const v of variables) {
    const id = String(v.id || '').trim();
    const name = String(v.varName || '').trim();
    if (!id || !name) continue;
    const nk = normalizeLabelKey(name);
    if (!exact.has(nk)) exact.set(nk, id);
    const parts = name
      .split('.')
      .map((p) => p.trim())
      .filter(Boolean);
    const seg = parts.length > 0 ? parts[parts.length - 1]! : name;
    if (seg) {
      const sk = normalizeLabelKey(seg);
      if (!lastSegment.has(sk)) lastSegment.set(sk, id);
    }
  }
  return { exact, lastSegment };
}

function lookupVarIdForLabel(label: string, index: LabelIndex): string | null {
  const k = normalizeLabelKey(label);
  const hit = index.exact.get(k);
  if (hit) return hit;
  return index.lastSegment.get(k) ?? null;
}

export function resolveMustacheLabelsToGuidForm(text: string, variables: VariableInstance[]): string {
  if (!text || !variables.length) return text;
  const index = buildLabelToVarIdIndex(variables);
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, inner: string) => {
    const trimmed = String(inner || '').trim();
    if (!trimmed) return _m;
    if (UUID_IN_TEXT.test(trimmed)) return `{{${trimmed}}}`;
    const vid = lookupVarIdForLabel(trimmed, index);
    return vid ? `{{${vid}}}` : _m;
  });
}

export function resolveBracketLabelsToGuidForm(text: string, variables: VariableInstance[]): string {
  const map = buildVariableGuidToVarNameMap(variables);
  if (!map.size || !text) return text;
  return convertDSLLabelsToGUIDs(text, map);
}

export function resolveVariableLabelsToInternalReferenceText(
  text: string,
  variables: VariableInstance[]
): string {
  if (!text) return text;
  let s = resolveBracketLabelsToGuidForm(text, variables);
  s = resolveMustacheLabelsToGuidForm(s, variables);
  return s;
}

function skipReferenceScanKey(k: string): boolean {
  return k === REFERENCE_SCAN_INTERNAL_TEXT_KEY;
}

function pickFirstNonEmptyString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

/**
 * Walks task JSON for compile: prefers compiledCode/compiledText, executableCode, then resolves script
 * and other string leaves from UI to GUID form.
 */
export function collectCompileTextChunksFromTaskJson(task: unknown, variables: VariableInstance[]): string[] {
  const out: string[] = [];

  const visitObject = (o: Record<string, unknown>, depth: number) => {
    if (out.length >= MAX_COMPILE_CHUNKS || depth > MAX_DEPTH) return;

    const compiled = pickFirstNonEmptyString(o, ['compiledCode', 'compiledText']);
    if (compiled) {
      out.push(compiled);
      for (const [k, v] of Object.entries(o)) {
        if (
          k === 'compiledCode' ||
          k === 'compiledText' ||
          k === 'executableCode' ||
          k === 'script' ||
          skipReferenceScanKey(k)
        ) {
          continue;
        }
        visitValue(v, depth + 1);
      }
      return;
    }

    const exec = pickFirstNonEmptyString(o, ['executableCode']);
    if (exec) {
      out.push(exec);
      for (const [k, v] of Object.entries(o)) {
        if (k === 'executableCode' || k === 'script' || skipReferenceScanKey(k)) continue;
        visitValue(v, depth + 1);
      }
      return;
    }

    const scr = pickFirstNonEmptyString(o, ['script']);
    if (scr) {
      out.push(resolveVariableLabelsToInternalReferenceText(scr, variables));
      for (const [k, v] of Object.entries(o)) {
        if (k === 'script' || skipReferenceScanKey(k)) continue;
        visitValue(v, depth + 1);
      }
      return;
    }

    for (const [k, v] of Object.entries(o)) {
      if (skipReferenceScanKey(k)) continue;
      visitValue(v, depth + 1);
    }
  };

  const visitValue = (v: unknown, depth: number) => {
    if (out.length >= MAX_COMPILE_CHUNKS || depth > MAX_DEPTH) return;
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      if (v) out.push(resolveVariableLabelsToInternalReferenceText(v, variables));
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return;
    if (Array.isArray(v)) {
      for (const x of v) {
        visitValue(x, depth + 1);
        if (out.length >= MAX_COMPILE_CHUNKS) return;
      }
      return;
    }
    if (typeof v === 'object') {
      visitObject(v as Record<string, unknown>, depth);
    }
  };

  visitValue(task, 0);
  return out;
}

/**
 * Joins compile chunks for Task.referenceScanInternalText.
 */
export function computeReferenceScanInternalTextForTask(
  task: unknown,
  variables: VariableInstance[]
): string {
  return collectCompileTextChunksFromTaskJson(task, variables).join('\n');
}

/**
 * Compiles all translation values to GUID form for optional persisted parallel map (reference scan).
 */
export function compileTranslationsToInternalMap(
  translations: Record<string, string> | undefined,
  variables: VariableInstance[]
): Record<string, string> | undefined {
  if (!translations || typeof translations !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(translations)) {
    if (v) out[k] = resolveVariableLabelsToInternalReferenceText(String(v), variables);
  }
  return out;
}
