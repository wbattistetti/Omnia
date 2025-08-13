import { v4 as uuidv4 } from 'uuid';
import type { SchemaNode } from './MainDataCollection';
import type { ArtifactStore } from './artifactStore';
import { getAllV2Draft } from './V2DraftStore';

export interface AssembledDDT {
  id: string;
  label: string;
  mainData: any[];
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

type AssembleOptions = {
  escalationCounts?: Partial<Record<'noMatch' | 'noInput' | 'confirmation', number>>;
};

export function assembleFinalDDT(rootLabel: string, mains: SchemaNode[], store: ArtifactStore, options?: AssembleOptions): AssembledDDT {
  const ddtId = `${rootLabel || 'DDT'}_${uuidv4()}`;
  const translations: Translations = {};
  const defaultEscalations = { noMatch: 3, noInput: 3, confirmation: 2 } as Record<string, number>;
  const counts = { ...defaultEscalations, ...(options?.escalationCounts || {}) } as Record<string, number>;

  const assembleNode = (node: SchemaNode, nodePath: string[]): any => {
    const nodeId = uuidv4();
    const path = pathFor(nodePath);
    const pathBucket = store.byPath[path];
    const isSub = nodePath.length > 1;

    // Base prompts → add to translations (best-effort)
    if (pathBucket) {
      const baseTypes: Array<keyof typeof pathBucket> = isSub
        ? ['start', 'noMatch', 'noInput']
        : ['start', 'noMatch', 'noInput', 'confirmation', 'success'];
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
      messages: {} as Record<string, any>,
      steps: {} as Record<string, any>,
    };

    // Constraints
    for (const c of node.constraints || []) {
      if (c.kind === 'required') continue;
      const cId = uuidv4();
      const cPath = path;
      const bucket = store.byPath[cPath]?.constraints?.[c.kind];
      // i18n keys for title/payoff
      const titleKey = `runtime.${ddtId}.${path}.constraint.${c.kind}.title`;
      const payoffKey = `runtime.${ddtId}.${path}.constraint.${c.kind}.payoff`;
      if (c.title) pushTranslation(translations, titleKey, String(c.title));
      if (c.payoff) pushTranslation(translations, payoffKey, String(c.payoff));

      const constraintObj: any = {
        id: cId,
        kind: c.kind,
        title: c.title, // keep raw for backward-compat
        payoff: c.payoff,
        titleKey,
        payoffKey,
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
          // Also expose as node-level messages so the editor can render them
          assembled.messages[`constraint.${c.kind}.r1`] = { textKey: r1Key };
          assembled.messages[`constraint.${c.kind}.r2`] = { textKey: r2Key };
          // And expose as virtual steps so they appear in the step strip
          assembled.steps[`constraint.${c.kind}.r1`] = {
            type: `constraint.${c.kind}.r1`,
            escalations: [
              {
                escalationId: `e_${uuidv4()}`,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: `a_${uuidv4()}`,
                    parameters: [{ parameterId: 'text', value: r1Key }]
                  }
                ]
              }
            ]
          };
          assembled.steps[`constraint.${c.kind}.r2`] = {
            type: `constraint.${c.kind}.r2`,
            escalations: [
              {
                escalationId: `e_${uuidv4()}`,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: `a_${uuidv4()}`,
                    parameters: [{ parameterId: 'text', value: r2Key }]
                  }
                ]
              }
            ]
          };
        }
      } else {
        // No AI messages: create placeholders so steps appear in the UI
        const r1Key = `runtime.${ddtId}.${path}.constraint.${c.kind}.r1`;
        const r2Key = `runtime.${ddtId}.${path}.constraint.${c.kind}.r2`;
        pushTranslation(translations, r1Key, `${node.label} · ${c.title || c.kind} · recovery 1`);
        pushTranslation(translations, r2Key, `${node.label} · ${c.title || c.kind} · recovery 2`);
        constraintObj.messages = { r1: r1Key, r2: r2Key };
        assembled.messages[`constraint.${c.kind}.r1`] = { textKey: r1Key };
        assembled.messages[`constraint.${c.kind}.r2`] = { textKey: r2Key };
        assembled.steps[`constraint.${c.kind}.r1`] = {
          type: `constraint.${c.kind}.r1`,
          escalations: [
            {
              escalationId: `e_${uuidv4()}`,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: `a_${uuidv4()}`,
                  parameters: [{ parameterId: 'text', value: r1Key }]
                }
              ]
            }
          ]
        };
        assembled.steps[`constraint.${c.kind}.r2`] = {
          type: `constraint.${c.kind}.r2`,
          escalations: [
            {
              escalationId: `e_${uuidv4()}`,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: `a_${uuidv4()}`,
                  parameters: [{ parameterId: 'text', value: r2Key }]
                }
              ]
            }
          ]
        };
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

    // Minimal base messages (ensure ResponseEditor displays steps)
    const baseSteps = (isSub ? ['start', 'noInput', 'noMatch'] : ['start', 'noInput', 'noMatch', 'confirmation', 'success']) as const;
    for (const stepKey of baseSteps) {
      const defaultKey = `runtime.${ddtId}.${path}.${stepKey}.text`;
      // Prefer AI-provided key if present (ai.0). We already pushed translations for it above.
      const ai0Key = `runtime.${ddtId}.${path}.${stepKey}.ai.0`;
      const chosenKey = translations[ai0Key] ? ai0Key : defaultKey;
      if (chosenKey === defaultKey && !translations[defaultKey]) {
        pushTranslation(translations, defaultKey, `${node.label} · ${stepKey}`);
      }
      // Debug to understand which key is used
      try {
        // eslint-disable-next-line no-console
        console.log('[assembleFinalDDT] step', path, stepKey, 'key', chosenKey, 'hasAI', Boolean(translations[ai0Key]));
      } catch {}
      assembled.messages[stepKey] = { textKey: chosenKey };
      const isAsk = ['text', 'email', 'number', 'date'].includes((node.type || '').toString());
      const baseAction = {
        actionId: stepKey === 'start' && isAsk ? 'askQuestion' : 'sayMessage',
        actionInstanceId: `a_${uuidv4()}`,
        parameters: [{ parameterId: 'text', value: chosenKey }]
      };
      const numEsc = counts[stepKey] || 1;
      const escalations = Array.from({ length: numEsc }).map(() => ({
        escalationId: `e_${uuidv4()}`,
        actions: [baseAction]
      }));
      assembled.steps[stepKey] = {
        type: stepKey,
        escalations
      };
    }

    return assembled;
  };

  const assembledMains = (mains || []).map(m => assembleNode(m, [m.label]));

  return {
    id: ddtId,
    label: rootLabel || 'Data',
    mainData: assembledMains,
    translations: { en: translations },
    v2Draft: getAllV2Draft(),
  };
}


