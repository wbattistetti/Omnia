import { v4 as uuidv4 } from 'uuid';
import type { SchemaNode } from './MainDataCollection';
import { normalizeDDTMainNodes } from './normalizeKinds';
import type { ArtifactStore } from './artifactStore';
import { getAllV2Draft } from './V2DraftStore';
import { taskTemplateService } from '../../../services/TaskTemplateService';
import { cloneAndAdaptContract, createSubIdMapping } from '../../../utils/contractUtils';

export interface AssembledDDT {
  id: string;
  label: string;
  mainData: any[];
  // ❌ REMOVED: translations - translations are now stored in global ProjectTranslationsContext
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
  templateTranslations?: Record<string, { en: string; it: string; pt: string }>; // Translations from template GUIDs
  projectLocale?: 'en' | 'it' | 'pt'; // Project language
  addTranslations?: (translations: Record<string, string>) => void; // ✅ Callback to add translations to global table
};

export async function assembleFinalDDT(rootLabel: string, mains: SchemaNode[], store: ArtifactStore, options?: AssembleOptions): Promise<AssembledDDT> {
  const ddtId = `${rootLabel || 'DDT'}_${uuidv4()}`;
  const translations: Translations = { en: {}, it: {}, pt: {} };
  // Limit AI-driven re-asks to max 2
  const defaultEscalations = { noMatch: 2, noInput: 2, confirmation: 2 } as Record<string, number>;
  const counts = { ...defaultEscalations, ...(options?.escalationCounts || {}) } as Record<string, number>;

  // ✅ projectLocale è OBBLIGATORIO - nessun fallback
  if (!options?.projectLocale) {
    throw new Error('[assembleFinalDDT] projectLocale is REQUIRED in options. Cannot assemble DDT without project language.');
  }
  const projectLocale = options.projectLocale;

  const templateTranslations = options?.templateTranslations || {};
  const addTranslations = options?.addTranslations; // ✅ Callback to add translations to global table

  // ✅ Collect translations for project locale only (flat dictionary: { guid: text })
  const projectTranslations: Record<string, string> = {};

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

    // Load source template and contract for cloning
    let sourceTemplate = null;
    let sourceContract = (node as any).nlpContract;

    // Log contract presence check
    console.log('🔍 [assembleFinal] Checking nlpContract', {
      nodeLabel: node.label,
      nodeKind: node.kind,
      hasContractOnNode: !!sourceContract,
      contractKeys: sourceContract ? Object.keys(sourceContract).slice(0, 5) : [],
      nodeKeys: Object.keys(node).slice(0, 15) // Debug: check all node keys
    });

    // ✅ If contract is already on node, use it directly (it was copied from template in ResponseEditor)
    if (sourceContract) {
      console.log('✅ [assembleFinal] Contract PRESENT on node (from ResponseEditor)', {
        nodeLabel: node.label,
        contractTemplateName: sourceContract.templateName,
        contractTemplateId: sourceContract.templateId
      });
    } else if ((node as any).templateId) {
      // ✅ CERCO PER GUID dal nodo (NO kind/name!)
      const templateGuid = (node as any).templateId;
      const template = taskTemplateService.getTemplateSync(templateGuid);

      if (template) {
        sourceTemplate = template;
        if ((template as any).nlpContract) {
          sourceContract = (template as any).nlpContract;
          console.log('✅ [assembleFinal] Contract trovato per GUID', {
            templateGuid,
            templateId: template.id,
            templateName: (template as any).name,
            hasContract: true
          });
        } else {
          console.warn('⚠️ [assembleFinal] Template trovato per GUID ma SENZA contract', {
            templateGuid,
            templateId: template.id,
            templateName: (template as any).name,
            templateKeys: Object.keys(template).slice(0, 10)
          });
        }
      } else {
        console.warn('⚠️ [assembleFinal] Template NON trovato per GUID', {
          templateGuid,
          nodeLabel: node.label
        });
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
      // Contract will be set after sub-instances are created
      nlpContract: undefined,
    };

    // ✅ Save node label to Translations (for current project locale)
    // This will be saved to DB when the DDT is saved
    if (node.label && nodeId) {
      projectTranslations[nodeId] = node.label;
      console.log('[assembleFinalDDT] ✅ Saved node label to translations', {
        nodeId: nodeId.substring(0, 20) + '...',
        label: node.label,
        locale: projectLocale,
        isSub: isSub
      });
    }

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
                    actionInstanceId: uuidv4(),
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
                    actionInstanceId: uuidv4(),
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
                  actionInstanceId: uuidv4(),
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
                  actionInstanceId: uuidv4(),
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
    // Create sub-instances first (needed for contract mapping)
    const subInstances: any[] = [];
    for (const s of node.subData || []) {
      const subHasStepPrompts = !!(s as any).stepPrompts && typeof (s as any).stepPrompts === 'object' && Object.keys((s as any).stepPrompts).length > 0;

      if (!subHasStepPrompts) {
        console.error('❌ [assembleFinal] Sub missing stepPrompts', {
          parent: node.label,
          sub: s.label
        });
      }

      // ✅ CRITICAL: Preserve stepPrompts when assembling subData
      const subNodeWithStepPrompts = {
        ...s,
        stepPrompts: (s as any).stepPrompts || undefined
      };
      const subInstance = await assembleNode(subNodeWithStepPrompts, [...nodePath, s.label]);
      subInstances.push(subInstance);
      assembled.subData.push(subInstance);
    }

    // ✅ Clone and adapt contract after sub-instances are created
    if (sourceContract) {
      // Get source template ID (from template or from contract itself if it's already an instance)
      // If contract is already an instance (has sourceTemplateId), use that; otherwise use template ID
      const sourceTemplateId = sourceContract.sourceTemplateId || sourceTemplate?.id || sourceContract.templateId || '';

      // Create mapping: sub-template IDs → sub-instance IDs
      // Extract sub-template IDs from original contract's subDataMapping
      const subTemplateIds = Object.keys(sourceContract.subDataMapping || {});
      const subInstanceIds = subInstances.map(sub => sub.id);

      console.log('🔍 [assembleFinal] Contract cloning setup', {
        nodeLabel: node.label,
        sourceTemplateId,
        subTemplateIds,
        subInstanceIds,
        contractIsInstance: !!sourceContract.sourceTemplateId,
        sourceContractMapping: Object.entries(sourceContract.subDataMapping || {}).map(([id, m]: [string, any]) => ({
          templateId: id.substring(0, 20) + '...',
          canonicalKey: m.canonicalKey,
          label: m.label
        }))
      });

      // Create mapping (assumes same order - if not, we'll need to match by label/canonicalKey)
      const subIdMapping = createSubIdMapping(subTemplateIds, subInstanceIds);

      // Clone and adapt contract (async - compiles regex if needed)
      const projectLanguage = projectLocale.toUpperCase(); // IT, PT, EN
      const instanceContract = await cloneAndAdaptContract(
        sourceContract,
        nodeId,  // Instance GUID
        sourceTemplateId,  // Source template GUID
        subIdMapping,
        projectLanguage
      );

      assembled.nlpContract = instanceContract;

      console.log('✅ [assembleFinal] Contract CLONED and ASSIGNED', {
        instanceId: nodeId,
        instanceLabel: node.label,
        sourceTemplateId: sourceTemplateId,
        templateName: instanceContract.templateName,
        contractTemplateId: instanceContract.templateId,
        contractSourceTemplateId: instanceContract.sourceTemplateId,
        subMappings: Object.keys(instanceContract.subDataMapping).length
      });
    } else {
      console.warn('❌ [assembleFinal] NO contract to clone', {
        nodeLabel: node.label,
        nodeKind: node.kind,
        nodeKeys: Object.keys(node).slice(0, 10)
      });
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
        } catch { }
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
        let templateKeyForEsc: string | null = null;

        // If using stepPrompts and there are multiple prompts, use the corresponding one
        // nodeStepPrompts[stepKey] is already an array of keys
        if (nodeStepPrompts && nodeStepPrompts[stepKey] && Array.isArray(nodeStepPrompts[stepKey]) && nodeStepPrompts[stepKey][escIdx]) {
          templateKeyForEsc = nodeStepPrompts[stepKey][escIdx];
        }

        // ✅ Generate new runtime GUID for instance (always generate new, even if template key exists)
        const actionInstanceId = uuidv4();

        // ✅ If we have a template key, copy translation from template to new runtime GUID
        if (templateKeyForEsc && templateTranslations[templateKeyForEsc]) {
          const templateTranslation = templateTranslations[templateKeyForEsc];
          // Copy translation for project locale only
          const templateText = templateTranslation[projectLocale] || templateTranslation.en || templateTranslation.it || templateTranslation.pt || '';

          if (templateText) {
            // ✅ Add translation to projectTranslations (flat dictionary for project locale only)
            projectTranslations[actionInstanceId] = templateText;

            console.log('[assembleFinalDDT] Copied translation from template', {
              path,
              stepKey,
              templateGuid: templateKeyForEsc,
              runtimeGuid: actionInstanceId,
              locale: projectLocale,
              text: templateText.substring(0, 50)
            });
          }
        }

        const baseAction = {
          actionId: stepKey === 'start' && isAsk ? 'askQuestion' : 'sayMessage',
          actionInstanceId: actionInstanceId,
          parameters: [{ parameterId: 'text', value: actionInstanceId }]
        };

        const escalation = {
          escalationId: `e_${uuidv4()}`,
          actions: [{
            ...baseAction,
            parameters: [{ parameterId: 'text', value: actionInstanceId }]
          }]
        };

        // Store template key mapping for reference (not used for translation lookup)
        if (templateKeyForEsc) {
          (escalation as any).__templateKey = templateKeyForEsc;
        }

        return escalation;
      });

      // The main message uses the first escalation's actionInstanceId
      if (escalations.length > 0 && escalations[0].actions?.[0]?.actionInstanceId) {
        const firstEscalationActionInstanceId = escalations[0].actions[0].actionInstanceId;
        const firstEscalationTemplateKey = (escalations[0] as any).__templateKey;
        assembled.messages[stepKey] = { textKey: firstEscalationActionInstanceId };
        // Also store template key if present in first escalation
        if (firstEscalationTemplateKey) {
          (assembled.messages[stepKey] as any).__templateKey = firstEscalationTemplateKey;
        }
        console.log('[assembleFinalDDT] Main message key set from first escalation', {
          path,
          stepKey,
          firstEscalationActionInstanceId,
          firstEscalationTemplateKey,
          escalationActionInstanceId: escalations[0].actions[0].actionInstanceId,
          keysMatch: firstEscalationActionInstanceId === escalations[0].actions[0].actionInstanceId
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

    // ✅ Use for...of loop to handle async assembleNode
    const assembledMains: any[] = [];
    for (let idx = 0; idx < (normalizedMains || []).length; idx++) {
      const m = normalizedMains![idx];
      console.log(`[assembleFinalDDT][ASSEMBLING] Main ${idx + 1}/${normalizedMains?.length}:`, m.label, '| subData:', (m.subData || []).length);
      try {
        const assembled = await assembleNode(m, [m.label]);
        console.log(`[assembleFinalDDT][ASSEMBLED] Main ${idx + 1}/${normalizedMains?.length}:`, m.label, '✓');
        assembledMains.push(assembled);
      } catch (err) {
        console.error(`[assembleFinalDDT][ERROR] Failed to assemble main ${idx + 1}:`, m.label, err);
        throw err;
      }
    }

    console.log('[assembleFinalDDT][COMPLETE]', {
      mainsCount: assembledMains.length,
      projectTranslationsCount: Object.keys(projectTranslations).length,
      projectLocale
    });

    // ✅ Add translations to global table (in memory only, not saved to DB yet)
    if (addTranslations && Object.keys(projectTranslations).length > 0) {
      addTranslations(projectTranslations);
      console.log('[assembleFinalDDT] ✅ Added translations to global table', {
        count: Object.keys(projectTranslations).length,
        sampleGuids: Object.keys(projectTranslations).slice(0, 5)
      });
    }

    // ❌ REMOVED: translations from result - translations are now in global ProjectTranslationsContext
    const result: AssembledDDT = {
      id: ddtId,
      label: rootLabel || 'Data',
      mainData: assembledMains,
      v2Draft: getAllV2Draft(),
    };

    console.log('[assembleFinalDDT][RESULT]', { id: result.id, label: result.label, mainsCount: result.mainData.length });
    return result;
  } catch (err) {
    console.error('[assembleFinalDDT][FATAL_ERROR]', err);
    throw err;
  }
}


