import { v4 as uuidv4 } from 'uuid';
import type { SchemaNode } from './MainDataCollection';
import { normalizeDDTMainNodes } from './normalizeKinds';
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

export function assembleFinalDDT(rootLabel: string, mains: SchemaNode[], store: ArtifactStore, options?: AssembleOptions): AssembledDDT {
  const ddtId = `${rootLabel || 'DDT'}_${uuidv4()}`;
  const translations: Translations = {};
  // Limit AI-driven re-asks to max 2
  const defaultEscalations = { noMatch: 2, noInput: 2, confirmation: 2 } as Record<string, number>;
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
      synonyms: [node.label, (node.label || '').toLowerCase()].filter(Boolean),
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

    // ✅ CRITICAL: Check sub-data stepPrompts before processing

    for (const s of node.subData || []) {
      const subHasStepPrompts = !!(s as any).stepPrompts && typeof (s as any).stepPrompts === 'object' && Object.keys((s as any).stepPrompts).length > 0;

      if (!subHasStepPrompts) {
        console.error('🔴 [CRITICAL] ASSEMBLE - SUB-DATA MISSING STEPPROMPTS', {
          parent: node.label,
          sub: s.label,
          subKeys: Object.keys(s),
          hasProp: 'stepPrompts' in s,
          value: (s as any).stepPrompts
        });
      } else {
        console.log('✅ [CRITICAL] ASSEMBLE - SUB-DATA HAS STEPPROMPTS', {
          parent: node.label,
          sub: s.label,
          keys: Object.keys((s as any).stepPrompts)
        });
      }

      assembled.subData.push(assembleNode(s, [...nodePath, s.label]));
    }

    // Minimal base messages (ensure ResponseEditor displays steps)
    const baseSteps = (isSub ? ['start', 'noInput', 'noMatch'] : ['start', 'noInput', 'noMatch', 'confirmation', 'notConfirmed', 'success']);

    // Check if node has stepPrompts from template match
    const nodeStepPrompts = (node as any).stepPrompts || null;

    // ✅ CRITICAL: Log for sub-data nodes
    if (isSub) {
      if (!nodeStepPrompts) {
        console.error('🔴 [CRITICAL] ASSEMBLE NODE - SUB-DATA NODE MISSING STEPPROMPTS', {
          path,
          label: node.label,
          nodeKeys: Object.keys(node),
          hasProp: 'stepPrompts' in node
        });
      } else {
        console.log('✅ [CRITICAL] ASSEMBLE NODE - SUB-DATA NODE HAS STEPPROMPTS', {
          path,
          label: node.label,
          keys: Object.keys(nodeStepPrompts)
        });
      }
    }

    for (const stepKey of baseSteps) {
      let chosenKey: string;
      let templateKeyForTranslation: string | null = null; // Store template key to load translations later

      // Priority 1: Use stepPrompts from template if available
      // stepPrompts structure: { start: ['template.time.start.prompt1'], noMatch: [...], ... }
      // nodeStepPrompts[stepKey] is already an array of keys, not an object with .keys property
      if (nodeStepPrompts && nodeStepPrompts[stepKey] && Array.isArray(nodeStepPrompts[stepKey]) && nodeStepPrompts[stepKey].length > 0) {
        // Store the template key to load translations later
        templateKeyForTranslation = nodeStepPrompts[stepKey][0];
        // Create a unique runtime key with GUID for this instance
        chosenKey = `runtime.${ddtId}.${uuidv4()}.text`;
        console.log('[assembleFinalDDT] Using stepPrompts key', {
          path,
          stepKey,
          templateKey: templateKeyForTranslation,
          runtimeKey: chosenKey,
          fromTemplate: true,
          isTemplateKey: templateKeyForTranslation.startsWith('template.'),
          allKeys: nodeStepPrompts[stepKey]
        });
      } else {
        // Fallback: Use AI-provided key or default
        const defaultKey = `runtime.${ddtId}.${path}.${stepKey}.text`;
        // Prefer AI-provided key if present (ai.0). We already pushed translations for it above.
        const ai0Key = `runtime.${ddtId}.${path}.${stepKey}.ai.0`;
        chosenKey = translations[ai0Key] ? ai0Key : defaultKey;
        if (chosenKey === defaultKey && !translations[defaultKey]) {
          pushTranslation(translations, defaultKey, `${node.label} · ${stepKey}`);
        }
        // Debug to understand which key is used
        try {
          // eslint-disable-next-line no-console
          console.log('[assembleFinalDDT] step', path, stepKey, 'key', chosenKey, 'hasAI', Boolean(translations[ai0Key]));
        } catch {}
      }

      const isAsk = ['text', 'email', 'number', 'date'].includes((node.type || '').toString());

      // If using stepPrompts, use the number of prompts as escalations
      let numEsc: number;
      // nodeStepPrompts[stepKey] is already an array of keys
      if (nodeStepPrompts && nodeStepPrompts[stepKey] && Array.isArray(nodeStepPrompts[stepKey])) {
        numEsc = nodeStepPrompts[stepKey].length;
      } else {
        numEsc = stepKey === 'notConfirmed' ? 2 : (counts[stepKey] || 1);
      }

      // Create escalations first - ALL escalations get unique runtime keys with GUID (including the first one)
      const escalations = Array.from({ length: numEsc }).map((_, escIdx) => {
        let actionKey: string;
        let templateKeyForEsc: string | null = null;

        // If using stepPrompts and there are multiple prompts, use the corresponding one
        // nodeStepPrompts[stepKey] is already an array of keys
        if (nodeStepPrompts && nodeStepPrompts[stepKey] && Array.isArray(nodeStepPrompts[stepKey]) && nodeStepPrompts[stepKey][escIdx]) {
          templateKeyForEsc = nodeStepPrompts[stepKey][escIdx];
          // ALWAYS create unique runtime key with GUID for ALL escalations (including escIdx === 0)
          actionKey = `runtime.${ddtId}.${uuidv4()}.text`;
        } else {
          // Fallback: create unique runtime key even without stepPrompts
          actionKey = `runtime.${ddtId}.${uuidv4()}.text`;
        }

        const baseAction = {
          actionId: stepKey === 'start' && isAsk ? 'askQuestion' : 'sayMessage',
          actionInstanceId: `a_${uuidv4()}`,
          parameters: [{ parameterId: 'text', value: actionKey }]
        };

        const escalation = {
          escalationId: `e_${uuidv4()}`,
          actions: [{
            ...baseAction,
            parameters: [{ parameterId: 'text', value: actionKey }]
          }]
        };

        // Store template key mapping for later translation copying (for ALL escalations)
        if (templateKeyForEsc) {
          (escalation as any).__templateKey = templateKeyForEsc;
        }

        return escalation;
      });

      // The main message uses the first escalation's key
      if (escalations.length > 0 && escalations[0].actions?.[0]?.parameters?.[0]?.value) {
        const firstEscalationKey = escalations[0].actions[0].parameters[0].value;
        const firstEscalationTemplateKey = (escalations[0] as any).__templateKey;
        assembled.messages[stepKey] = { textKey: firstEscalationKey };
        // Also store template key if present in first escalation
        if (firstEscalationTemplateKey) {
          (assembled.messages[stepKey] as any).__templateKey = firstEscalationTemplateKey;
        }
        console.log('[assembleFinalDDT] Main message key set from first escalation', {
          path,
          stepKey,
          firstEscalationKey,
          firstEscalationTemplateKey,
          escalationActionKey: escalations[0].actions[0].parameters[0].value,
          keysMatch: firstEscalationKey === escalations[0].actions[0].parameters[0].value
        });
      } else {
        // Fallback: use chosenKey if no escalations (should not happen)
        assembled.messages[stepKey] = { textKey: chosenKey };
        if (templateKeyForTranslation) {
          (assembled.messages[stepKey] as any).__templateKey = templateKeyForTranslation;
        }
        console.log('[assembleFinalDDT] Main message key set from chosenKey (fallback)', {
          path,
          stepKey,
          chosenKey,
          templateKeyForTranslation
        });
      }

      assembled.steps[stepKey] = {
        type: stepKey,
        escalations
      };
    }

    return assembled;
  };

  // Normalize kinds/subs deterministically so extractors work out of the box
  try {
    console.log('[assembleFinalDDT][START]', { rootLabel, mainsCount: mains.length, mainLabels: mains.map(m => m.label) });

    const normalizedMains = normalizeDDTMainNodes(mains as any);
    console.log('[assembleFinalDDT][NORMALIZED]', { count: normalizedMains?.length || 0, labels: (normalizedMains || []).map((m: any) => m.label) });

    const assembledMains = (normalizedMains || []).map((m, idx) => {
      console.log(`[assembleFinalDDT][ASSEMBLING] Main ${idx + 1}/${normalizedMains?.length}:`, m.label, '| subData:', (m.subData || []).length);
      try {
        const assembled = assembleNode(m, [m.label]);
        console.log(`[assembleFinalDDT][ASSEMBLED] Main ${idx + 1}/${normalizedMains?.length}:`, m.label, '✓');
        return assembled;
      } catch (err) {
        console.error(`[assembleFinalDDT][ERROR] Failed to assemble main ${idx + 1}:`, m.label, err);
        throw err;
      }
    });

    console.log('[assembleFinalDDT][COMPLETE]', { mainsCount: assembledMains.length, translationsCount: Object.keys(translations).length });

    // Initialize translations structure with all locales (en, it, pt)
    // This ensures the structure is correct even if template translations haven't been loaded yet
    const result = {
      id: ddtId,
      label: rootLabel || 'Data',
      mainData: assembledMains,
      translations: {
        en: translations,
        it: {},
        pt: {}
      },
      v2Draft: getAllV2Draft(),
    };

    console.log('[assembleFinalDDT][RESULT]', { id: result.id, label: result.label, mainsCount: result.mainData.length });
    return result;
  } catch (err) {
    console.error('[assembleFinalDDT][FATAL_ERROR]', err);
    throw err;
  }
}


