import { v4 as uuidv4 } from 'uuid';
import type { SchemaNode } from './MainDataCollection';
import type { ArtifactStore, normalizePathSegment } from './artifactStore';

export interface AssembledDDT {
  id: string;
  label: string;
  mains: any[];
  translations: { en: Record<string, string> };
}

type Translations = Record<string, string>;

function pathFor(nodePath: string[]): string {
  return nodePath.map(s => s.replace(/\//g, '-')).join('/');
}

function pushTranslation(translations: Translations, key: string, text: string) {
  if (!key || typeof text !== 'string') return;
  translations[key] = text;
}

function extractBasePromptKeys(stepPayload: any): Record<string, string> {
  // Expect payloads like { ai: { textKey: '...', text: '...' } } or similar.
  // We map any string values into translation keys if already keyed, otherwise skip.
  const out: Record<string, string> = {};
  if (!stepPayload || typeof stepPayload !== 'object') return out;
  // Heuristic pass-through; concrete mapping will be tuned as backend stabilizes
  for (const [k, v] of Object.entries(stepPayload)) {
    if (typeof v === 'string') out[k] = v;
    if (v && typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v as any)) {
        if (typeof v2 === 'string') out[`${k}.${k2}`] = v2;
      }
    }
  }
  return out;
}

export function assembleFinalDDT(rootLabel: string, mains: SchemaNode[], store: ArtifactStore): AssembledDDT {
  const ddtId = `${rootLabel || 'DDT'}_${uuidv4()}`;
  const translations: Translations = {};

  const assembleNode = (node: SchemaNode, nodePath: string[]): any => {
    const nodeId = uuidv4();
    const path = pathFor(nodePath);
    const pathBucket = store.byPath[path];

    // Base prompts → add to translations (best-effort)
    if (pathBucket) {
      const baseTypes: Array<keyof typeof pathBucket> = ['start', 'noMatch', 'noInput', 'confirmation', 'success'];
      for (const t of baseTypes) {
        const payload = (pathBucket as any)[t];
        if (payload) {
          const pairs = extractBasePromptKeys(payload);
          for (const [k, v] of Object.entries(pairs)) {
            const key = `runtime.${ddtId}.${path}.${t}.${k}`;
            pushTranslation(translations, key, String(v));
          }
        }
      }
    }

    const assembled: any = {
      id: nodeId,
      label: node.label,
      type: node.type,
      icon: node.icon,
      constraints: [] as any[],
      subData: [] as any[],
    };

    // Constraints
    for (const c of node.constraints || []) {
      if (c.kind === 'required') continue;
      const cId = uuidv4();
      const cPath = path;
      const bucket = store.byPath[cPath]?.constraints?.[c.kind];
      const constraintObj: any = {
        id: cId,
        kind: c.kind,
        title: c.title,
        payoff: c.payoff,
        params: Object.fromEntries(Object.entries(c).filter(([k]) => !['kind', 'title', 'payoff'].includes(k))),
      };

      // Messages escalation
      const messages = bucket?.messages?.messages;
      if (Array.isArray(messages)) {
        // Expect [{ constraintId?, r1: {title,payoff,messageKey?}, r2: {...} }]
        const first = messages[0];
        if (first?.r1) {
          const r1Key = `runtime.${ddtId}.${path}.constraint.${c.kind}.r1`;
          const r2Key = `runtime.${ddtId}.${path}.constraint.${c.kind}.r2`;
          if (first.r1.payoff) pushTranslation(translations, r1Key, String(first.r1.payoff));
          if (first.r2?.payoff) pushTranslation(translations, r2Key, String(first.r2.payoff));
          constraintObj.messages = { r1: r1Key, r2: r2Key };
        }
      }

      // Validator + testset
      if (bucket?.validator?.validatorTs) {
        constraintObj.validatorTs = bucket.validator.validatorTs;
      }
      if (bucket?.testset?.cases) {
        constraintObj.testset = bucket.testset.cases;
      }

      assembled.constraints.push(constraintObj);
    }

    // SubData
    for (const s of node.subData || []) {
      assembled.subData.push(assembleNode(s, [...nodePath, s.label]));
    }

    return assembled;
  };

  const assembledMains = (mains || []).map(m => assembleNode(m, [m.label]));

  return {
    id: ddtId,
    label: rootLabel || 'Data',
    mains: assembledMains,
    translations: { en: translations },
  };
}


