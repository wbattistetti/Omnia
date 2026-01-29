import { v4 as uuidv4 } from 'uuid';
import type { SchemaNode } from './dataCollection';
import { normalizeDDTMainNodes } from './normalizeKinds';
import type { ArtifactStore } from './artifactStore';
import { getAllV2Draft } from './V2DraftStore';
import { taskTemplateService } from '../../../services/TaskTemplateService';
import { cloneAndAdaptContract, createSubIdMapping } from '../../../utils/contractUtils';
import { TaskType, templateIdToTaskType } from '../../../types/taskTypes';
import { extractTranslationKeysFromSteps } from '../../../utils/stepsConverter';

// ✅ REMOVED: extractPromptsFromMainData - DEPRECATED
// Ora usiamo extractStartPrompts da ddtPromptExtractor.ts direttamente

// ✅ REMOVED: adaptStartPromptsToContext - DEPRECATED
// Ora usiamo AdaptPromptToContext da ddtPromptAdapter.ts che gestisce tutto in modo centralizzato

export interface AssembledDDT {
  id: string;
  label: string;
  data: any[];  // ✅ Solo struttura dati (senza steps)
  steps?: Record<string, any>;  // ✅ Steps a root level: { "nodeId": { start: {...}, noMatch: {...} } }
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

/**
 * Find the corresponding node in a template by matching structure.
 * Strategy:
 * 1. For data nodes: return first data node from template
 * 2. For subTasks nodes: find by templateId match (if available) or by position
 */
function findTemplateNodeByPosition(template: any, nodePath: string[], node?: SchemaNode): any | null {
  if (!template || !template.data || !Array.isArray(template.data)) {
    return null;
  }

  const isSub = nodePath.length > 1;

  if (!isSub) {
    // data node: return first data node from template
    // (Most templates have a single data node)
    return template.data[0] || null;
  }

  // SubData node: try to find by templateId match first, then fallback to position
  const nodeTemplateId = node ? (node as any).templateId : null;

  // Find parent data (assume first data for now)
  const mainNode = template.data[0];
  if (!mainNode || !mainNode.subTasks || !Array.isArray(mainNode.subTasks)) {
    return null;
  }

  // Strategy 1: If node has templateId, try to find subTasks with matching templateId
  // (This works when subTasks nodes reference their own templates)
  if (nodeTemplateId) {
    const matchedSub = mainNode.subTasks.find((sub: any) => sub.templateId === nodeTemplateId);
    if (matchedSub) {
      return matchedSub;
    }
  }

  // Strategy 2: Fallback to position-based matching
  // Find subTasks at the same position in the path
  // nodePath format: ['main', 'sub0', 'sub1', ...]
  const subDataIndex = nodePath.length > 1 ? parseInt(nodePath[1]) || 0 : 0;
  if (subDataIndex < mainNode.subTasks.length) {
    return mainNode.subTasks[subDataIndex];
  }

  // Strategy 3: Last resort - return first subTasks
  return mainNode.subTasks[0] || null;
}

/**
 * Find template node by ID (recursive search in data and subData)
 */
function findTemplateNodeById(template: any, nodeId: string): any | null {
  if (!template || !template.data || !Array.isArray(template.data)) {
    return null;
  }

  // Search in data
  for (const mainNode of template.data) {
    if (mainNode.id === nodeId) {
      return mainNode;
    }
    // Search in subTasks
    if (mainNode.subTasks && Array.isArray(mainNode.subTasks)) {
      for (const subNode of mainNode.subTasks) {
        if (subNode.id === nodeId) {
          return subNode;
        }
      }
    }
  }

  return null;
}

/**
 * Resolve node ID: use existing ID if present, otherwise find in template or generate new.
 * Priority:
 * 1. Use node.id if present (already from template/instance - CORRECT)
 * 2. Find in template by templateId if node derives from template (fallback - should be rare)
 * 3. Generate new ID for standalone nodes
 */
function resolveNodeId(node: SchemaNode, sourceTemplate: any | null, nodePath: string[]): string {
  // ✅ PRIORITY 1: Se il nodo ha già un ID, usalo direttamente (è già il GUID del template)
  // Questo è il caso corretto: il nodo deriva dal template e ha già l'ID preservato
  if ((node as any).id && typeof (node as any).id === 'string') {
    console.log('[resolveNodeId] ✅ Using existing node ID (preserved from template/instance)', {
      nodeLabel: node.label,
      nodeId: (node as any).id,
      hasTemplateId: !!(node as any).templateId
    });
    return (node as any).id;
  }

  // ✅ PRIORITY 2: Se deriva da template ma non ha ID, cerca nel template
  // Questo caso dovrebbe essere RARO se i mapping preservano sempre l'id
  // È un fallback per nodi creati senza preservare l'ID (bug da fixare)
  if ((node as any).templateId && sourceTemplate) {
    // Try to find by templateId match first (more reliable)
    const templateNode = findTemplateNodeById(sourceTemplate, (node as any).templateId);
    if (templateNode?.id) {
      console.warn('[resolveNodeId] ⚠️ Node missing ID but has templateId - found in template (mapping bug?)', {
        nodeLabel: node.label,
        templateNodeId: templateNode.id,
        templateId: (node as any).templateId,
        nodePath: nodePath.join('/')
      });
      return templateNode.id;
    }

    // Fallback: try position-based matching (less reliable)
    const templateNodeByPosition = findTemplateNodeByPosition(sourceTemplate, nodePath, node);
    if (templateNodeByPosition?.id) {
      console.warn('[resolveNodeId] ⚠️ Node missing ID - found by position (mapping bug?)', {
        nodeLabel: node.label,
        templateNodeId: templateNodeByPosition.id,
        templateId: (node as any).templateId,
        nodePath: nodePath.join('/')
      });
      return templateNodeByPosition.id;
    }

    console.warn('[resolveNodeId] ⚠️ Template node not found, generating new ID', {
      nodeLabel: node.label,
      templateId: (node as any).templateId,
      nodePath: nodePath.join('/')
    });
  }

  // ✅ PRIORITY 3: Standalone node - genera nuovo ID
  const newNodeId = uuidv4();
  console.log('[resolveNodeId] ✅ Generated new ID (standalone node)', {
    nodeLabel: node.label,
    newNodeId: newNodeId.substring(0, 20) + '...'
  });
  return newNodeId;
}

/**
 * Resolve node label: if node derives from template, use template node label; otherwise use node label.
 * This preserves structural labels (multilingual) from template.
 */
function resolveNodeLabel(node: SchemaNode, sourceTemplate: any | null, nodePath: string[]): string {
  // If node derives from template, find corresponding template node and use its label
  if ((node as any).templateId && sourceTemplate) {
    const templateNode = findTemplateNodeByPosition(sourceTemplate, nodePath, node);
    if (templateNode?.label) {
      console.log('[resolveNodeLabel] ✅ Using template node label (structural)', {
        nodeLabel: node.label,
        templateLabel: templateNode.label,
        templateId: (node as any).templateId,
        isSub: nodePath.length > 1
      });
      return templateNode.label;
    } else {
      console.warn('[resolveNodeLabel] ⚠️ Template node not found, using node label', {
        nodeLabel: node.label,
        templateId: (node as any).templateId,
        nodePath: nodePath.join('/')
      });
    }
  }

  // Standalone node or template node not found: use node label
  console.log('[resolveNodeLabel] ✅ Using node label (standalone)', {
    nodeLabel: node.label
  });
  return node.label;
}

type AssembleOptions = {
  escalationCounts?: Partial<Record<'noMatch' | 'noInput' | 'confirmation', number>>;
  templateTranslations?: Record<string, { en: string; it: string; pt: string }>; // Translations from template GUIDs
  projectLocale?: 'en' | 'it' | 'pt'; // Project language
  addTranslations?: (translations: Record<string, string>) => void; // ✅ Callback to add translations to global table
  contextLabel?: string; // ✅ Context label for prompt adaptation (e.g., "Chiedi la data di nascita del paziente")
  templateLabel?: string; // ✅ Template label (e.g., "Date") - used to identify the original template
  aiProvider?: 'groq' | 'openai'; // ✅ AI provider for prompt adaptation
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

  // ✅ Create rootSteps at the beginning (before assembleNode) - steps will be added directly here
  const rootSteps: Record<string, any> = {};

  const assembleNode = async (node: SchemaNode, nodePath: string[]): Promise<any> => {
    const path = pathFor(nodePath);
    const pathBucket = store.byPath[path];
    const isSub = nodePath.length > 1;

    // Load source template and contract for cloning (BEFORE resolving nodeId/label)
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

    // ✅ RESOLVE NODE ID: preserve template node ID if deriving from template
    const nodeId = resolveNodeId(node, sourceTemplate, nodePath);

    // ✅ Initialize steps for this nodeId in rootSteps (not in assembled)
    rootSteps[nodeId] = {};

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

    // ✅ RESOLVE NODE LABEL: preserve template node label if deriving from template
    const nodeLabel = resolveNodeLabel(node, sourceTemplate, nodePath);

    const assembled: any = {
      id: nodeId,
      label: nodeLabel,
      type: node.type,
      icon: node.icon,
      constraints: [] as any[],
      subTasks: [] as any[],
      messages: {} as Record<string, any>,
      // ❌ REMOVED: steps - steps are now created directly in rootSteps[nodeId]
      synonyms: [nodeLabel, (nodeLabel || '').toLowerCase()].filter(Boolean),
      // Contract will be set after sub-instances are created
      nlpContract: undefined,
    };

    // ✅ Save node label to Translations (for current project locale)
    // This will be saved to DB when the DDT is saved
    // Use resolved label (from template if deriving, otherwise from node)
    if (nodeLabel && nodeId) {
      projectTranslations[nodeId] = nodeLabel;
      console.log('[assembleFinalDDT] ✅ Saved node label to translations', {
        nodeId: nodeId.substring(0, 20) + '...',
        label: nodeLabel,
        locale: projectLocale,
        isSub: isSub,
        fromTemplate: !!(node as any).templateId && sourceTemplate
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
          // ✅ Add constraint steps directly to rootSteps (not in assembled)
          rootSteps[nodeId][`constraint.${c.kind}.r1`] = {
            type: `constraint.${c.kind}.r1`,
            escalations: [
              {
                escalationId: `e_${uuidv4()}`,
                tasks: [  // ✅ Renamed from actions
                  {
                    id: uuidv4(),              // ✅ Standard: id (GUID univoco)
                    templateId: 'sayMessage',  // ✅ Renamed from actionId
                    parameters: [{ parameterId: 'text', value: r1Key }]
                  }
                ],
                actions: [{  // ✅ Legacy alias for backward compatibility
                  actionId: 'sayMessage',
                  actionInstanceId: uuidv4(),
                  parameters: [{ parameterId: 'text', value: r1Key }]
                }]
              }
            ]
          };
          rootSteps[nodeId][`constraint.${c.kind}.r2`] = {
            type: `constraint.${c.kind}.r2`,
            escalations: [
              {
                escalationId: `e_${uuidv4()}`,
                tasks: [  // ✅ Renamed from actions
                  {
                    id: uuidv4(),              // ✅ Standard: id (GUID univoco)
                    templateId: 'sayMessage',  // ✅ Renamed from actionId
                    parameters: [{ parameterId: 'text', value: r2Key }]
                  }
                ],
                actions: [{  // ✅ Legacy alias for backward compatibility
                  actionId: 'sayMessage',
                  actionInstanceId: uuidv4(),
                  parameters: [{ parameterId: 'text', value: r2Key }]
                }]
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
        // ✅ Add constraint steps directly to rootSteps (not in assembled)
        rootSteps[nodeId][`constraint.${c.kind}.r1`] = {
          type: `constraint.${c.kind}.r1`,
          escalations: [
            {
              escalationId: `e_${uuidv4()}`,
              tasks: [  // ✅ Renamed from actions
                {
                  id: uuidv4(),              // ✅ Standard: id (GUID univoco)
                  templateId: 'sayMessage',  // ✅ Renamed from actionId
                  parameters: [{ parameterId: 'text', value: r1Key }]
                }
              ],
              actions: [{  // ✅ Legacy alias for backward compatibility
                actionId: 'sayMessage',
                actionInstanceId: uuidv4(),
                parameters: [{ parameterId: 'text', value: r1Key }]
              }]
            }
          ]
        };
        rootSteps[nodeId][`constraint.${c.kind}.r2`] = {
          type: `constraint.${c.kind}.r2`,
          escalations: [
            {
              escalationId: `e_${uuidv4()}`,
              tasks: [  // ✅ Renamed from actions
                {
                  id: uuidv4(),              // ✅ Standard: id (GUID univoco)
                  templateId: 'sayMessage',  // ✅ Renamed from actionId
                  parameters: [{ parameterId: 'text', value: r2Key }]
                }
              ],
              actions: [{  // ✅ Legacy alias for backward compatibility
                actionId: 'sayMessage',
                actionInstanceId: uuidv4(),
                parameters: [{ parameterId: 'text', value: r2Key }]
              }]
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

    // ✅ CRITICAL: Check sub-data steps before processing
    // Create sub-instances first (needed for contract mapping)
    const subInstances: any[] = [];
    for (const s of node.subTasks || []) {
      const subNodeId = (s as any).templateId || s.id;
      const subHasSteps = !!(s as any).steps && typeof (s as any).steps === 'object' && subNodeId && (s as any).steps[subNodeId];

      if (!subHasSteps) {
        console.error('❌ [assembleFinal] Sub missing steps', {
          parent: node.label,
          sub: s.label,
          subNodeId
        });
      }

      // ✅ Preserve steps when assembling subTasks
      const subNodeWithSteps = {
        ...s,
        steps: (s as any).steps || undefined
      };
      const subInstance = await assembleNode(subNodeWithSteps, [...nodePath, s.label]);
      subInstances.push(subInstance);
      assembled.subTasks.push(subInstance);
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

    // ✅ Leggi steps (formato nuovo)
    const nodeId = (node as any).templateId || (node as any).id;
    const nodeSteps = (node as any).steps;

    // Estrai chiavi di traduzione da steps
    let nodesteps: Record<string, string[]> | null = null;
    if (nodeSteps && nodeId && nodeSteps[nodeId]) {
      nodesteps = extractTranslationKeysFromSteps(nodeSteps, nodeId);
    }

    // ✅ CRITICAL: Log for sub-data nodes
    if (isSub) {
      if (!nodesteps) {
        console.error('🔴 [CRITICAL] ASSEMBLE NODE - SUB-DATA NODE MISSING steps', {
          path,
          label: node.label,
          nodeKeys: Object.keys(node),
          hasProp: 'steps' in node
        });
      } else {
        console.log('✅ [CRITICAL] ASSEMBLE NODE - SUB-DATA NODE HAS steps', {
          path,
          label: node.label,
          keys: Object.keys(nodesteps)
        });
      }
    }

    for (const stepKey of baseSteps) {
      let chosenKey: string;
      let templateKeyForTranslation: string | null = null; // Store template key to load translations later

      // Priority 1: Use steps/steps from template if available
      // ✅ NUOVO: steps viene convertito in formato steps compatibile (array di chiavi)
      // steps structure: { start: ['template.time.start.prompt1'], noMatch: [...], ... }
      // nodesteps[stepKey] is already an array of keys, not an object with .keys property
      if (nodesteps && nodesteps[stepKey] && Array.isArray(nodesteps[stepKey]) && nodesteps[stepKey].length > 0) {
        // Store the template key to load translations later
        templateKeyForTranslation = nodesteps[stepKey][0];
        // Create a unique runtime key with GUID for this instance
        chosenKey = `runtime.${ddtId}.${uuidv4()}.text`;
        console.log('[assembleFinalDDT] Using steps/steps key', {
          path,
          stepKey,
          templateKey: templateKeyForTranslation,
          runtimeKey: chosenKey,
          fromTemplate: true,
          isTemplateKey: templateKeyForTranslation.startsWith('template.'),
          allKeys: nodesteps[stepKey]
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

      // If using steps/steps, use the number of prompts as escalations
      let numEsc: number;
      // nodesteps[stepKey] is already an array of keys (estratte da steps o da steps legacy)
      if (nodesteps && nodesteps[stepKey] && Array.isArray(nodesteps[stepKey])) {
        numEsc = nodesteps[stepKey].length;
      } else {
        numEsc = stepKey === 'notConfirmed' ? 2 : (counts[stepKey] || 1);
      }

      // Create escalations first - ALL escalations get unique runtime keys with GUID (including the first one)
      const escalations = Array.from({ length: numEsc }).map((_, escIdx) => {
        let templateKeyForEsc: string | null = null;

        // If using steps/steps and there are multiple prompts, use the corresponding one
        // nodesteps[stepKey] is already an array of keys (estratte da steps o da steps legacy)
        if (nodesteps && nodesteps[stepKey] && Array.isArray(nodesteps[stepKey]) && nodesteps[stepKey][escIdx]) {
          templateKeyForEsc = nodesteps[stepKey][escIdx];
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

        // ✅ Rimosso askQuestion, usa DataRequest per step 'start' quando isAsk
        const templateIdForTask = stepKey === 'start' && isAsk ? 'UtteranceInterpretation' : 'sayMessage';
        const taskType = templateIdToTaskType(templateIdForTask) || TaskType.SayMessage;

        const baseTask = {
          id: actionInstanceId,      // ✅ Standard: id (GUID univoco)
          type: taskType,             // ✅ Aggiunto campo type (enum numerico)
          templateId: null,           // ✅ null = standalone task (non deriva da altri Task)
          parameters: [{ parameterId: 'text', value: actionInstanceId }]
        };

        const escalation = {
          escalationId: `e_${uuidv4()}`,
          tasks: [{  // ✅ Renamed from actions
            ...baseTask,
            parameters: [{ parameterId: 'text', value: actionInstanceId }]
          }],
          actions: [{  // ✅ Legacy alias for backward compatibility
            actionId: templateIdForTask,
            actionInstanceId: actionInstanceId,
            parameters: [{ parameterId: 'text', value: actionInstanceId }]
          }]
        };

        // Store template key mapping for reference (not used for translation lookup)
        if (templateKeyForEsc) {
          (escalation as any).__templateKey = templateKeyForEsc;
        }

        return escalation;
      });

      // The main message uses the first escalation's taskId
      // ✅ UNIFIED MODEL: Use tasks (complete Task objects)
      const firstTask = escalations[0]?.tasks?.[0] || escalations[0]?.actions?.[0];
      if (escalations.length > 0 && firstTask?.id) {
        const firstEscalationTaskId = firstTask.id;
        const firstEscalationTemplateKey = (escalations[0] as any).__templateKey;
        assembled.messages[stepKey] = { textKey: firstEscalationTaskId };
        // Also store template key if present in first escalation
        if (firstEscalationTemplateKey) {
          (assembled.messages[stepKey] as any).__templateKey = firstEscalationTemplateKey;
        }
        console.log('[assembleFinalDDT] Main message key set from first escalation', {
          path,
          stepKey,
          firstEscalationTaskId,
          firstEscalationTemplateKey,
          escalationTaskId: firstTask.id,
          keysMatch: firstEscalationTaskId === firstTask.id
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

      // ✅ Add step directly to rootSteps (not in assembled)
      rootSteps[nodeId][stepKey] = {
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
      console.log(`[assembleFinalDDT][ASSEMBLING] Main ${idx + 1}/${normalizedMains?.length}:`, m.label, '| subTasks:', (m.subTasks || []).length);
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

    // ✅ REMOVED: Prompt adaptation logic from assembleFinalDDT
    // L'adattamento dei prompt è ora gestito da AdaptPromptToContext in ddtPromptAdapter.ts
    // Questo viene chiamato da ddtOrchestrator.ts quando si crea un DDT da template
    // assembleFinalDDT ora si limita ad assemblare la struttura, senza adattare i prompt

    // ✅ Add translations to global table (in memory only, not saved to DB yet)
    if (addTranslations && Object.keys(projectTranslations).length > 0) {
      addTranslations(projectTranslations);
      console.log('[assembleFinalDDT] ✅ Added translations to global table', {
        count: Object.keys(projectTranslations).length,
        sampleGuids: Object.keys(projectTranslations).slice(0, 5)
      });
    }

    // ✅ Steps are already at root level (created directly in rootSteps during assembleNode)
    console.log('[assembleFinalDDT] ✅ Steps created directly at root level', {
      rootStepsCount: Object.keys(rootSteps).length,
      rootStepsKeys: Object.keys(rootSteps)
    });

    // ❌ REMOVED: translations from result - translations are now in global ProjectTranslationsContext
    const result: AssembledDDT = {
      id: ddtId,
      label: rootLabel || 'Data',
      data: assembledMains,  // ✅ data ora senza steps (solo struttura dati)
      steps: Object.keys(rootSteps).length > 0 ? rootSteps : undefined,  // ✅ Steps a root level
      v2Draft: getAllV2Draft(),
    };

    console.log('[assembleFinalDDT][RESULT]', {
      id: result.id,
      label: result.label,
      mainsCount: result.data.length,
      hasSteps: !!result.steps,
      stepsCount: result.steps ? Object.keys(result.steps).length : 0
    });
    return result;
  } catch (err) {
    console.error('[assembleFinalDDT][FATAL_ERROR]', err);
    throw err;
  }
}


