import { v4 as uuidv4 } from 'uuid';
import type { SchemaNode } from './MainDataCollection';
import type { ArtifactStore } from './artifactStore';
import { getAllV2Draft } from './V2DraftStore';

export interface AssembledDDT {
  id: string;
  label: string;
  mainData: any[];
  translations: { en: Record<string, string> };
  v2Draft?: any;
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

async function aiDraftNlpProfile(input: { label: string; type?: string; kind?: string; constraints?: any[]; locale: string }): Promise<any | null> {
  try {
    const API_BASE = (import.meta as any)?.env?.VITE_AI_URL || '/api';
    const API_KEY = (import.meta as any)?.env?.VITE_AI_KEY;
    const res = await fetch(`${API_BASE}/ai/nlpProfileDraft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
        ...(API_KEY && !(import.meta as any)?.env?.VITE_USE_AUTH_HEADER ? { 'X-API-Key': API_KEY } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch (_) {
    return null;
  }
}

export async function assembleFinalDDT(rootLabel: string, mains: SchemaNode[], store: ArtifactStore, options?: AssembleOptions): Promise<AssembledDDT> {
  const ddtId = `${rootLabel || 'DDT'}_${uuidv4()}`;
  const translations: Translations = {};
  // Limit AI-driven re-asks to max 2
  const defaultEscalations = { noMatch: 2, noInput: 2, confirmation: 2 } as Record<string, number>;
  const counts = { ...defaultEscalations, ...(options?.escalationCounts || {}) } as Record<string, number>;

  const assembleNode = async (node: SchemaNode, nodePath: string[]): Promise<any> => {
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
      synonyms: [node.label, (node.label || '').toLowerCase()].filter(Boolean),
    };

    // Default NLP extractor profile (auto-derived)
    // Infer kind from node.type/label
    const typeStr = String((node as any)?.type || '').toLowerCase();
    const labelStr = String(node?.label || '').toLowerCase();
    let kind: string = (node as any)?.kind || typeStr || 'generic';
    if (/date|dob|birth/.test(typeStr) || /date|dob|birth/.test(labelStr)) kind = 'date';
    if (/email/.test(typeStr) || /email/.test(labelStr)) kind = 'email';
    if (/phone|tel/.test(typeStr) || /phone|tel/.test(labelStr)) kind = 'phone';
    if (/address/.test(typeStr) || /address/.test(labelStr)) kind = 'address';
    if (/name/.test(typeStr) || /name/.test(labelStr)) kind = 'name';
    const autoSynonyms = [node.label, (node.label || '').toLowerCase()].filter(Boolean);
    const profile: any = {
      slotId: nodeId,
      locale: 'it-IT',
      kind: String(kind),
      synonyms: autoSynonyms,
      minConfidence: 0.6,
    };
    // Simple regex suggestions from constraints
    const nodeConstraints = (node as any)?.constraints || [];
    const kinds = new Set<string>(String(kind).toLowerCase().split(','));
    if (kinds.has('date')) {
      profile.formatHints = ['dd/MM/yyyy', 'd/M/yyyy', 'd MMMM yyyy', 'd MMM yyyy'];
      // regex/examples will be provided by AI only
    }
    const hasEmail = (nodeConstraints as any[]).some((c: any) => (c?.kind || '').toLowerCase() === 'email');
    const hasPhone = (nodeConstraints as any[]).some((c: any) => (c?.kind || '').toLowerCase() === 'phone');
    const hasZip = (nodeConstraints as any[]).some((c: any) => /(zip|cap|postal)/i.test(c?.kind || ''));
    if (hasEmail) profile.regex = "^\\S+@\\S+\\.\\S+$";
    if (hasPhone) profile.regex = profile.regex || "^\\+?\\d[\\d\\s-]{6,}$";
    if (hasZip) profile.regex = profile.regex || "\\b\\d{5}\\b";
    // Try generative AI draft profile and merge
    const ai = await aiDraftNlpProfile({ label: node.label, type: (node as any)?.type, kind: String(kind), constraints: (node as any)?.constraints, locale: 'it-IT' });
    if (ai && typeof ai === 'object') {
      try {
        if (Array.isArray(ai.synonyms)) {
          const merged = [...profile.synonyms, ...ai.synonyms].filter(Boolean);
          profile.synonyms = Array.from(new Set(merged));
        }
        if (Array.isArray(ai.examples) && ai.examples.length) profile.examples = ai.examples;
        if (typeof ai.regex === 'string' && ai.regex.trim()) profile.regex = ai.regex.trim();
        if (Array.isArray(ai.formatHints) && ai.formatHints.length) profile.formatHints = ai.formatHints;
        if (typeof ai.minConfidence === 'number') profile.minConfidence = ai.minConfidence;
        if (ai.postProcess) {
          profile.postProcess = typeof ai.postProcess === 'string'
            ? JSON.parse(ai.postProcess as string)
            : ai.postProcess;
        }
        profile.source = 'ai';
      } catch {
        // ignore AI parsing issues
      }
    }

    (assembled as any).nlpProfile = profile;

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
      assembled.subData.push(await assembleNode(s, [...nodePath, s.label]));
    }

    // Minimal base messages (ensure ResponseEditor displays steps)
    const baseSteps = (isSub ? ['start', 'noInput', 'noMatch'] : ['start', 'noInput', 'noMatch', 'confirmation', 'notConfirmed', 'success']);
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
      const numEsc = stepKey === 'notConfirmed' ? 2 : (counts[stepKey] || 1);
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

  const assembledMains = [] as any[];
  for (const m of (mains || [])) {
    assembledMains.push(await assembleNode(m, [m.label]));
  }

  return {
    id: ddtId,
    label: rootLabel || 'Data',
    mainData: assembledMains,
    translations: { en: translations },
    v2Draft: getAllV2Draft(),
  };
}


