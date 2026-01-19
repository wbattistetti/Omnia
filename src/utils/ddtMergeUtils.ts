import type { Task } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Load DDT from template (reference) and instance (steps + overrides)
 *
 * This function loads the DDT structure for the editor by combining:
 * - Template structure (mainData, constraints, examples, nlpContract) - source of truth
 * - Instance overrides (steps with cloned task IDs, modified constraints/examples)
 *
 * Rules:
 * - label, steps: Always from instance (always editable)
 * - mainData structure: From template (reference), but allows instance additions
 * - constraints, examples, nlpContract: From template (reference), unless overridden in instance
 *
 * Structure:
 * - Nodes with templateId !== null: Structure from template, steps cloned with new task IDs, contracts from template
 * - Nodes with templateId === null: Complete structure from instance (added nodes)
 */
export async function loadDDTFromTemplate(instance: Task | null): Promise<any | null> {
  if (!instance) return null;

  // If no templateId or templateId is "UNDEFINED", this is a standalone instance (has full structure)
  // "UNDEFINED" is a placeholder for tasks that haven't been typed yet, not a real template
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    return {
      label: instance.label,
      mainData: instance.mainData || [],
      steps: instance.steps,  // ✅ Steps a root level (già nel formato corretto)
      constraints: instance.constraints,
      examples: instance.examples
    };
  }

  // Load template from DialogueTaskService
  const template = DialogueTaskService.getTemplate(instance.templateId);
  if (!template) {
    // Template not found, return instance as-is (fallback)
    console.warn('[ddtMergeUtils] Template not found:', instance.templateId);
    return {
      label: instance.label,
      mainData: instance.mainData || [],
      steps: instance.steps,  // ✅ Steps a root level (già nel formato corretto)
      constraints: instance.constraints,
      examples: instance.examples
    };
  }

  // ✅ Build template structure for reference (to get contracts/constraints)
  const { mainData: templateMainData, guidMapping: templateGuidMapping } = buildMainDataFromTemplate(template);

  // ✅ ITERATE ON instance.mainData (not templateMainData) to include added nodes
  const instanceMainData = instance.mainData || [];

  // If instance has no mainData, build from template
  if (instanceMainData.length === 0) {
    const allGuidMappings = new Map<string, string>(templateGuidMapping);
    const enrichedMainData = templateMainData.map((templateNode: any) => {
      // ✅ Process subData (no steps in nodes anymore)
      const enrichedSubData = (templateNode.subData || []).map((subNode: any) => {
        return subNode; // ✅ No steps in nodes
      });

      return {
        ...templateNode,
        // ❌ REMOVED: steps - steps are now at root level
        subData: enrichedSubData
      };
    });

    // ✅ Clone steps from template.steps[nodeId] directly to rootSteps
    const rootSteps: Record<string, any> = {};
    const cloneStepsForNode = (node: any, nodeId: string) => {
      if (!nodeId) return;

      // ✅ Get steps from template.steps[nodeId] (root level)
      if (template.steps && template.steps[nodeId]) {
        const templateSteps = template.steps[nodeId];
        const { cloned, guidMapping } = cloneStepsWithNewTaskIds(templateSteps);
        guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
        rootSteps[nodeId] = cloned;
      }

      // ✅ Process subData recursively
      if (node.subData && Array.isArray(node.subData)) {
        node.subData.forEach((sub: any) => {
          if (sub.id) cloneStepsForNode(sub, sub.id);
        });
      }
    };

    enrichedMainData.forEach((main: any) => {
      if (main.id) cloneStepsForNode(main, main.id);
    });

    const result = {
      label: instance.label ?? template.label,
      mainData: enrichedMainData,  // ✅ mainData ora senza steps
      steps: Object.keys(rootSteps).length > 0 ? rootSteps : undefined,  // ✅ Steps a root level
      constraints: instance.constraints ?? template.dataContracts ?? template.constraints ?? undefined,
      examples: instance.examples ?? template.examples ?? undefined,
      nlpContract: instance.nlpContract ?? template.nlpContract ?? undefined
    };

    // ✅ Copy translations for cloned steps (only on first instance creation)
    const isFirstTimeCreation = (!instance.mainData || instance.mainData.length === 0) && !instance.steps;
    if (isFirstTimeCreation && allGuidMappings.size > 0) {
      const templateId = template.id || template._id;
      if (templateId) {
        await copyTranslationsForClonedSteps(result, templateId, allGuidMappings);
      }
    }

    return result;
  }

  // ✅ Build enriched mainData from instance.mainData
  const enrichedMainData = instanceMainData.map((instanceNode: any) => {
    if (instanceNode.templateId) {
      // ✅ NODE FROM TEMPLATE: get structure from template, apply prompts from instance, contracts from template
      const templateNode = findTemplateNodeByTemplateId(templateMainData, instanceNode.templateId);

      if (templateNode) {
        // ✅ Use structure from template (label, type, icon, constraints, examples, nlpContract)
        // ✅ Steps are handled at root level, not in nodes

        console.log('[loadDDTFromTemplate] 🔍 Merging node from template', {
          instanceNodeTemplateId: instanceNode.templateId,
          templateNodeId: templateNode.id,
          templateHasSteps: !!(template.steps && template.steps[templateNode.id])
        });

        return {
          ...templateNode,  // ✅ Structure from template (includes contracts/constraints)
          // ❌ REMOVED: steps - steps are now at root level
          // ✅ Enrich subData recursively
          subData: enrichSubDataFromInstance(instanceNode.subData || [], templateNode.subData || [])
        };
      } else {
        // Template node not found, use instance node as-is (fallback)
        console.warn('[loadDDTFromTemplate] ⚠️ Template node not found, using instance node as-is', {
          instanceNodeTemplateId: instanceNode.templateId
        });
        return instanceNode;
      }
    } else {
      // ✅ NODE ADDED IN INSTANCE (templateId === null): use complete structure from instance
      return instanceNode;  // ✅ Complete structure copied
    }
  });

  // ✅ Usa direttamente steps a root level (già nel formato corretto)
  let finalRootSteps: Record<string, any> | undefined = undefined;

  if (instance.steps && typeof instance.steps === 'object' && Object.keys(instance.steps).length > 0) {
    // Instance ha già steps a root level - usali
    finalRootSteps = instance.steps;
  } else if (template.steps && typeof template.steps === 'object' && Object.keys(template.steps).length > 0) {
    // Template ha steps a root level - clonali per prima creazione
    const isFirstTimeCreation = (!instance.mainData || instance.mainData.length === 0) && !instance.steps;
    if (isFirstTimeCreation) {
      // Clona steps dal template con nuovi task IDs
      finalRootSteps = {};
      for (const [nodeId, templateSteps] of Object.entries(template.steps)) {
        if (templateSteps && typeof templateSteps === 'object') {
          const { cloned } = cloneStepsWithNewTaskIds(templateSteps as any);
          finalRootSteps[nodeId] = cloned;
        }
      }
    }
  }

  // Root level: use instance if present (override), otherwise template
  const result = {
    label: instance.label ?? template.label,
    mainData: enrichedMainData,  // ✅ mainData ora senza steps (solo struttura dati)
    steps: finalRootSteps,  // ✅ Steps a root level
    constraints: instance.constraints ?? template.dataContracts ?? template.constraints ?? undefined,
    examples: instance.examples ?? template.examples ?? undefined,
    nlpContract: instance.nlpContract ?? template.nlpContract ?? undefined
  };

  // ✅ Copy translations for cloned steps (only on first instance creation)
  // Check if instance has already been initialized (has mainData or steps)
  const isFirstTimeCreation = (!instance.mainData || instance.mainData.length === 0) && !instance.steps;
  if (isFirstTimeCreation) {
    const templateId = template.id || template._id;
    if (templateId) {
      // Build guidMapping from templateMainData
      const allGuidMappings = new Map<string, string>(templateGuidMapping);
      await copyTranslationsForClonedSteps(result, templateId, allGuidMappings);
    }
  }

  return result;
}

/**
 * Clone steps structure with new task IDs (for instance creation)
 * Copies the structure but generates new IDs for all tasks
 * Returns both cloned steps and a mapping of old GUID -> new GUID
 */
function cloneStepsWithNewTaskIds(steps: any): { cloned: any; guidMapping: Map<string, string> } {
  if (!steps || typeof steps !== 'object') {
    return { cloned: {}, guidMapping: new Map() };
  }

  const cloned: any = {};
  const guidMapping = new Map<string, string>();

  // Handle both object format { start: { escalations: [...] } } and array format [{ type: 'start', escalations: [...] }]
  if (Array.isArray(steps)) {
    const clonedArray = steps.map((step: any) => ({
      ...step,
      escalations: (step.escalations || []).map((esc: any) => cloneEscalationWithNewTaskIds(esc, guidMapping))
    }));
    return { cloned: clonedArray, guidMapping };
  }

  for (const [stepKey, stepValue] of Object.entries(steps)) {
    if (stepValue && typeof stepValue === 'object') {
      if (Array.isArray((stepValue as any).escalations)) {
        // Format: { start: { escalations: [...] } }
        cloned[stepKey] = {
          ...stepValue,
          escalations: ((stepValue as any).escalations || []).map((esc: any) => cloneEscalationWithNewTaskIds(esc, guidMapping))
        };
      } else if ((stepValue as any).type) {
        // Format: { start: { type: 'start', escalations: [...] } }
        cloned[stepKey] = {
          ...stepValue,
          escalations: ((stepValue as any).escalations || []).map((esc: any) => cloneEscalationWithNewTaskIds(esc, guidMapping))
        };
      } else {
        cloned[stepKey] = stepValue;
      }
    } else {
      cloned[stepKey] = stepValue;
    }
  }

  return { cloned, guidMapping };
}

/**
 * Clone escalation with new task IDs
 * Maintains mapping of old GUID -> new GUID for translation copying
 */
function cloneEscalationWithNewTaskIds(escalation: any, guidMapping: Map<string, string>): any {
  if (!escalation) return escalation;

  const cloned = {
    ...escalation,
    escalationId: escalation.escalationId ? `e_${uuidv4()}` : undefined,
    tasks: (escalation.tasks || escalation.actions || []).map((task: any) => {
      const oldGuid = task.id;
      const newGuid = uuidv4();
      if (oldGuid) {
        guidMapping.set(oldGuid, newGuid);
      }
      return {
        ...task,
        id: newGuid,  // ✅ New ID for task instance
        // Keep templateId, params, etc. from original
      };
    }),
    actions: (escalation.actions || []).map((action: any) => {
      const oldGuid = action.actionInstanceId || action.taskId;
      const newGuid = uuidv4();
      if (oldGuid) {
        guidMapping.set(oldGuid, newGuid);
      }
      return {
        ...action,
        actionInstanceId: newGuid,  // ✅ New ID for action instance (legacy)
        // Keep actionId, parameters, etc. from original
      };
    })
  };

  return cloned;
}


/**
 * Build mainData structure from template (reference structure)
 * ✅ AGGIORNATO: Usa solo template.steps[nodeId] (non più template.mainData[].steps)
 * Returns both mainData and guidMapping for translation copying
 */
export function buildMainDataFromTemplate(template: any): { mainData: any[]; guidMapping: Map<string, string> } {
  const allGuidMappings = new Map<string, string>();

  // ✅ Check if template has mainData structure
  if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
    // Template has mainData - clone structure and steps from template.steps[nodeId]
    const mainData = template.mainData.map((mainNode: any) => {
      const templateNodeId = mainNode.id;
      let clonedMainSteps = undefined;

      // ✅ Get steps from template.steps[nodeId] (root level)
      if (templateNodeId && template.steps && template.steps[templateNodeId]) {
        const templateSteps = template.steps[templateNodeId];
        const { cloned, guidMapping } = cloneStepsWithNewTaskIds(templateSteps);
        guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
        clonedMainSteps = cloned;
      }

      // ✅ Process subData - get steps from template.steps[subNodeId]
      const subData = (mainNode.subData || []).map((subNode: any) => {
        const templateSubNodeId = subNode.id;
        let clonedSubSteps = undefined;

        if (templateSubNodeId && template.steps && template.steps[templateSubNodeId]) {
          const templateSubSteps = template.steps[templateSubNodeId];
          const { cloned, guidMapping: subGuidMapping } = cloneStepsWithNewTaskIds(templateSubSteps);
          subGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
          clonedSubSteps = cloned;
        }

        return {
          ...subNode,
          // ❌ REMOVED: steps - steps are now at root level, not in nodes
        };
      });

      return {
        ...mainNode,
        // ❌ REMOVED: steps - steps are now at root level, not in nodes
        subData: subData
      };
    });

    return { mainData, guidMapping: allGuidMappings };
  }

  // ✅ Build from subDataIds (composite template)
  const subDataIds = template.subDataIds || [];

  if (subDataIds.length > 0) {
    // Template composito: crea UN SOLO mainData con subData[]
    const subDataInstances: any[] = [];
    for (const subId of subDataIds) {
      const subTemplate = DialogueTaskService.getTemplate(subId);
      if (subTemplate) {
        // ✅ Get steps from subTemplate.steps[nodeId] (root level)
        let subSteps = undefined;
        if (subTemplate.mainData && Array.isArray(subTemplate.mainData) && subTemplate.mainData.length > 0) {
          const subTemplateNodeId = subTemplate.mainData[0].id;
          if (subTemplateNodeId && subTemplate.steps && subTemplate.steps[subTemplateNodeId]) {
            subSteps = subTemplate.steps[subTemplateNodeId];
          }
        }

        // Clone sub steps and collect mappings
        let clonedSubSteps = undefined;
        if (subSteps) {
          const { cloned, guidMapping: subGuidMapping } = cloneStepsWithNewTaskIds(subSteps);
          subGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
          clonedSubSteps = cloned;
        }

        // ✅ Get referenceId from the referenced template's mainData[0].id
        // This is the dataId that will be used in memory at runtime
        let referenceId: string | undefined;
        if (subTemplate.mainData && Array.isArray(subTemplate.mainData) && subTemplate.mainData.length > 0) {
          referenceId = subTemplate.mainData[0].id;
        } else {
          // Fallback: use template id if mainData structure not available
          referenceId = subTemplate.id || subTemplate._id;
        }

        // ✅ Validate: templateId must point to existing template (already checked above)
        // ✅ Validate: referenceId must be a valid dataId (checked above)

        subDataInstances.push({
          id: subTemplate.id || subTemplate._id,
          label: subTemplate.label || subTemplate.name || 'Sub',
          type: subTemplate.type,
          icon: subTemplate.icon || 'FileText',
          // ❌ REMOVED: steps - steps are now at root level, not in nodes
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          examples: subTemplate.examples || [],
          nlpContract: subTemplate.nlpContract || undefined,
          subData: [],
          templateId: subTemplate.id || subTemplate._id, // ✅ GUID del task referenziato
          referenceId: referenceId, // ✅ dataId del mainData[0] del template referenziato
          kind: subTemplate.name || subTemplate.type || 'generic'
        });
      }
    }

    // ✅ Get steps from template.steps[nodeId] (root level)
    let mainSteps = undefined;
    if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
      const templateNodeId = template.mainData[0].id;
      if (templateNodeId && template.steps && template.steps[templateNodeId]) {
        mainSteps = template.steps[templateNodeId];
      }
    }

    // Clone main steps and collect mappings
    let clonedMainSteps = undefined;
    if (mainSteps) {
      const { cloned, guidMapping: mainGuidMapping } = cloneStepsWithNewTaskIds(mainSteps);
      mainGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
      clonedMainSteps = cloned;
    }

    const result = [{
      id: template.id || template._id,
      label: template.label || template.name || 'Data',
      type: template.type,
      icon: template.icon || 'Calendar',
      // ❌ REMOVED: steps - steps are now at root level, not in nodes
      constraints: template.dataContracts || template.constraints || [],
      examples: template.examples || [],
      nlpContract: template.nlpContract || undefined,
      subData: subDataInstances,
      templateId: template.id || template._id,
      kind: template.name || template.type || 'generic'
    }];

    return { mainData: result, guidMapping: allGuidMappings };
  } else {
    // Template semplice
    // ✅ Get steps from template.steps[nodeId] (root level)
    let mainSteps = undefined;
    if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
      const templateNodeId = template.mainData[0].id;
      if (templateNodeId && template.steps && template.steps[templateNodeId]) {
        mainSteps = template.steps[templateNodeId];
      }
    }

    // Clone main steps and collect mappings
    let clonedMainSteps = undefined;
    if (mainSteps) {
      const { cloned, guidMapping: mainGuidMapping } = cloneStepsWithNewTaskIds(mainSteps);
      mainGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
      clonedMainSteps = cloned;
    }

    return {
      mainData: [{
        id: template.id || template._id,
        label: template.label || template.name || 'Data',
        type: template.type,
        icon: template.icon || 'Calendar',
        // ❌ REMOVED: steps - steps are now at root level, not in nodes
        constraints: template.dataContracts || template.constraints || [],
        examples: template.examples || [],
        nlpContract: template.nlpContract || undefined,
        subData: [],
        templateId: template.id || template._id,
        kind: template.name || template.type || 'generic'
      }],
      guidMapping: allGuidMappings
    };
  }
}

/**
 * Copy translations for cloned steps
 * Uses guidMapping to map old GUIDs (from template) to new GUIDs (in instance)
 * Loads translations for old GUIDs and saves them for new GUIDs
 */
async function copyTranslationsForClonedSteps(_ddt: any, _templateId: string, guidMapping: Map<string, string>): Promise<void> {
  try {
    if (!guidMapping || guidMapping.size === 0) {
      return; // No mappings to process
    }

    // Get old GUIDs (from template) - these have translations in the database
    const oldGuids = Array.from(guidMapping.keys());

    // Load template translations for OLD GUIDs (these exist in the database)
    const { getTemplateTranslations } = await import('../services/ProjectDataService');
    const templateTranslations = await getTemplateTranslations(oldGuids);

    // Get project locale
    const projectLocale = (localStorage.getItem('project.lang') || 'it') as 'en' | 'it' | 'pt';

    // Build translations dictionary for instance (NEW GUIDs -> text from template)
    // Map: oldGuid -> newGuid -> text
    const instanceTranslations: Record<string, string> = {};
    for (const oldGuid of oldGuids) {
      const newGuid = guidMapping.get(oldGuid);
      if (!newGuid) continue;

      const templateTrans = templateTranslations[oldGuid];
      if (templateTrans) {
        // Extract text for project locale
        const text = typeof templateTrans === 'object'
          ? (templateTrans[projectLocale] || templateTrans.en || templateTrans.it || templateTrans.pt || '')
          : String(templateTrans);

        if (text) {
          instanceTranslations[newGuid] = text; // ✅ Use NEW GUID as key
        }
      }
    }

    // Add translations to global table via window context (in memory) AND save to database
    if (Object.keys(instanceTranslations).length > 0) {
      // Try to add to in-memory context first
      const translationsContext = (window as any).__projectTranslationsContext;
      if (translationsContext && translationsContext.addTranslations) {
        translationsContext.addTranslations(instanceTranslations);
      } else {
        console.warn('[copyTranslationsForClonedSteps] ProjectTranslationsContext not available, will save to DB only');
      }

      // ✅ Always save directly to database (even if context is not available)
      try {
        // Try multiple methods to get project ID
        let projectId: string | null = null;
        try {
          projectId = localStorage.getItem('currentProjectId');
        } catch { }
        if (!projectId) {
          try {
            const runtime = await import('../state/runtime');
            projectId = runtime.getCurrentProjectId();
          } catch { }
        }
        if (!projectId) {
          projectId = (window as any).currentProjectId || (window as any).__currentProjectId || null;
        }

        if (projectId) {
          const { saveProjectTranslations } = await import('../services/ProjectDataService');
          const projectLocale = (localStorage.getItem('project.lang') || 'it') as 'en' | 'it' | 'pt';

          const translationsToSave = Object.entries(instanceTranslations).map(([guid, text]) => ({
            guid,
            language: projectLocale,
            text: text as string,
            type: 'Instance'
          }));

          await saveProjectTranslations(projectId, translationsToSave);

          // ✅ Reload translations in context if available (to ensure UI sees the new translations)
          const translationsContext = (window as any).__projectTranslationsContext;
          if (translationsContext && translationsContext.loadAllTranslations) {
            try {
              await translationsContext.loadAllTranslations();
            } catch (reloadErr) {
              console.warn('[copyTranslationsForClonedSteps] Failed to reload translations in context:', reloadErr);
            }
          }
        } else {
          console.warn('[copyTranslationsForClonedSteps] No project ID available, cannot save to database');
        }
      } catch (saveErr) {
        console.error('[copyTranslationsForClonedSteps] Error saving translations to database:', saveErr);
      }
    }
  } catch (err) {
    console.error('[copyTranslationsForClonedSteps] Error copying translations:', err);
  }
}


/**
 * Find template node by templateId
 */
function findTemplateNodeByTemplateId(templateMainData: any[], templateId: string): any | null {
  for (const mainNode of templateMainData) {
    if (mainNode.templateId === templateId) {
      return mainNode;
    }
    // Check subData
    if (mainNode.subData && Array.isArray(mainNode.subData)) {
      for (const subNode of mainNode.subData) {
        if (subNode.templateId === templateId) {
          return subNode;
        }
      }
    }
  }
  return null;
}

/**
 * Enrich subData from instance (apply instance prompts, but keep template contracts)
 */
function enrichSubDataFromInstance(instanceSubData: any[], templateSubData: any[]): any[] {
  return instanceSubData.map((instanceSub: any) => {
    if (instanceSub.templateId) {
      // ✅ SUB-DATA FROM TEMPLATE: get structure from template, apply prompts from instance
      const templateSub = templateSubData.find((t: any) => t.templateId === instanceSub.templateId);

      if (templateSub) {
        // ✅ Clone steps from template with new task IDs, or use steps from instance if modified
        const subSteps = instanceSub.steps ?? (templateSub.steps ? cloneStepsWithNewTaskIds(templateSub.steps) : undefined);

        return {
          ...templateSub,  // ✅ Structure from template (includes contracts/constraints)
          steps: subSteps  // ✅ Clone steps with new task IDs
        };
      } else {
        // Template sub not found, use instance as-is (fallback)
        return instanceSub;
      }
    } else {
      // ✅ SUB-DATA ADDED IN INSTANCE (templateId === null): use complete structure from instance
      return instanceSub;  // ✅ Complete structure copied
    }
  });
}




/**
 * Check if data contracts (constraints/examples/nlpContract) have been modified in instance
 * Returns true if instance has overrides (data contracts are present in instance)
 */
export function hasDataContractOverrides(instance: Task | null): boolean {
  if (!instance) return false;

  // Check root level
  if (instance.constraints || instance.examples || instance.nlpContract) {
    return true;
  }

  // Check mainData nodes
  if (instance.mainData && Array.isArray(instance.mainData)) {
    for (const mainNode of instance.mainData) {
      if (mainNode.constraints || mainNode.examples || mainNode.nlpContract) {
        return true;
      }
      // Check subData nodes
      if (mainNode.subData && Array.isArray(mainNode.subData)) {
        for (const subNode of mainNode.subData) {
          if (subNode.constraints || subNode.examples || subNode.nlpContract) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Compare only data structure (without logic/overrides)
 * Returns true if structure is identical, false if different
 *
 * Structure includes:
 * - mainData[].id, label, type
 * - mainData[].subData[] (array of referenceId/templateId)
 * - Semantics (Atomic/Composite/Collection)
 *
 * Structure does NOT include:
 * - steps, escalations (logic)
 * - constraints, examples, nlpContract (overrides)
 */
function compareDataStructure(localMainData: any[], templateMainData: any[]): boolean {
  if (localMainData.length !== templateMainData.length) {
    return false; // Different number of mainData nodes
  }

  for (let i = 0; i < localMainData.length; i++) {
    const localNode = localMainData[i];
    const templateNode = templateMainData[i] || templateMainData[0]; // Fallback to first

    // Compare main node structure (id, label, type, templateId, referenceId)
    if (localNode.id !== templateNode.id ||
        localNode.label !== templateNode.label ||
        localNode.type !== templateNode.type ||
        localNode.templateId !== templateNode.templateId ||
        (localNode.referenceId || localNode.id) !== (templateNode.referenceId || templateNode.id)) {
      return false; // Structure changed
    }

    // Compare subData structure (only referenceId/templateId, not logic)
    const localSubData = localMainData[i].subData || [];
    const templateSubData = templateNode.subData || [];

    if (localSubData.length !== templateSubData.length) {
      return false; // Different number of subData
    }

    for (let j = 0; j < localSubData.length; j++) {
      const localSub = localSubData[j];
      const templateSub = templateSubData[j];

      // Compare subData structure (templateId, referenceId, label)
      if (localSub.templateId !== templateSub.templateId ||
          (localSub.referenceId || localSub.id) !== (templateSub.referenceId || templateSub.id) ||
          localSub.label !== templateSub.label) {
        return false; // Structure changed
      }
    }
  }

  return true; // Structure is identical
}

/**
 * Extract only modified fields from DDT (compared to template)
 *
 * LOGICA CORRETTA:
 * - Il template definisce SOLO la struttura dei dati (mainData, subData, dataId, semantica)
 * - L'istanza definisce la logica (step, escalation, constraints, examples, nlpContract)
 * - Se la struttura è identica → salva solo override (logica)
 * - Se la struttura è diversa → salva tutto (derivazione rotta, diventa standalone)
 *
 * VANTAGGI:
 * - Elimina duplicazione: stessa struttura salvata N volte per N istanze
 * - Override legittimi: step/escalation possono divergere senza rompere derivazione
 * - Performance: meno dati nel database, lookup template in memoria (O(1))
 */
export async function extractModifiedDDTFields(instance: Task | null, localDDT: any): Promise<Partial<Task>> {
  if (!instance || !localDDT) {
    return localDDT || {};
  }

  // ✅ Se no templateId, questo è un template o istanza standalone → salva tutto
  if (!instance.templateId) {
    return {
      label: localDDT.label,
      mainData: localDDT.mainData,
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localDDT.constraints,
      examples: localDDT.examples,
      nlpContract: localDDT.nlpContract,
      introduction: localDDT.introduction
    };
  }

  // ✅ Carica template per confronto
  const template = DialogueTaskService.getTemplate(instance.templateId);
  if (!template) {
    // ❌ Template non trovato → salva tutto (non può risolvere lazy)
    console.warn(`[extractModifiedDDTFields] Template ${instance.templateId} not found - saving everything (cannot resolve lazy)`);
    return {
      label: localDDT.label,
      mainData: localDDT.mainData,
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localDDT.constraints,
      examples: localDDT.examples,
      nlpContract: localDDT.nlpContract,
      introduction: localDDT.introduction
    };
  }

  // ✅ Salva sempre label (sempre modificabile)
  const result: Partial<Task> = {
    label: localDDT.label,
    steps: {} // ✅ CORRETTO: Inizializza steps a root level (unica fonte di verità)
  };

  // ✅ Confronta SOLO la struttura dei dati (senza step, constraints, etc.)
  // Usa template.mainData direttamente (non buildMainDataFromTemplate che clona già gli step)
  // Oppure costruisci struttura base da subDataIds se template composito
  let templateStructureForCompare: any[] = [];

  if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
    // Template ha mainData: usa direttamente (senza step, constraints, etc.)
    templateStructureForCompare = template.mainData.map((main: any) => ({
      id: main.id,
      label: main.label,
      type: main.type,
      templateId: main.templateId,
      referenceId: main.referenceId || main.id,
      subData: (main.subData || []).map((sub: any) => ({
        templateId: sub.templateId,
        referenceId: sub.referenceId || sub.id,
        label: sub.label
      }))
    }));
  } else if (template.subDataIds && Array.isArray(template.subDataIds) && template.subDataIds.length > 0) {
    // Template composito: costruisci struttura base (solo id, label, type, subData con templateId/referenceId)
    templateStructureForCompare = [{
      id: template.id || template._id,
      label: template.label || template.name || 'Data',
      type: template.type,
      templateId: template.id || template._id,
      referenceId: template.id || template._id,
      subData: template.subDataIds.map((subId: string) => {
        const subTemplate = DialogueTaskService.getTemplate(subId);
        if (subTemplate) {
          return {
            templateId: subTemplate.id || subTemplate._id,
            referenceId: subTemplate.mainData?.[0]?.id || subTemplate.id || subTemplate._id,
            label: subTemplate.label || subTemplate.name || 'Sub'
          };
        }
        return { templateId: subId, referenceId: subId, label: 'Sub' };
      })
    }];
  }

  // ✅ Normalizza localDDT.mainData per confronto (solo struttura, senza step, constraints, etc.)
  const localStructureForCompare = (localDDT.mainData || []).map((main: any) => ({
    id: main.id,
    label: main.label,
    type: main.type,
    templateId: main.templateId,
    referenceId: main.referenceId || main.id,
    subData: (main.subData || []).map((sub: any) => ({
      templateId: sub.templateId,
      referenceId: sub.referenceId || sub.id,
      label: sub.label
    }))
  }));

  console.log('[extractModifiedDDTFields] 🔍 Comparing structure', {
    localMainDataLength: localDDT.mainData?.length || 0,
    templateMainDataLength: templateStructureForCompare.length,
    localStructure: JSON.stringify(localStructureForCompare, null, 2).substring(0, 500),
    templateStructure: JSON.stringify(templateStructureForCompare, null, 2).substring(0, 500)
  });

  const structureIdentical = compareDataStructure(
    localStructureForCompare,
    templateStructureForCompare
  );

  console.log('[extractModifiedDDTFields] ✅ Structure comparison result', {
    structureIdentical,
    localMainDataLength: localDDT.mainData?.length || 0
  });

  if (!structureIdentical) {
    // ✅ Struttura diversa → derivazione rotta → salva tutto (diventa standalone)
    console.log('[extractModifiedDDTFields] ⚠️ Structure changed - saving full mainData (derivation broken)', {
      localMainDataLength: localDDT.mainData?.length || 0,
      templateMainDataLength: templateStructureForCompare.length
    });
    return {
      label: localDDT.label,
      mainData: localDDT.mainData, // ✅ Salva struttura completa
      steps: instance.steps || {}, // ✅ CORRETTO: Salva steps da task (unica fonte di verità)
      constraints: localDDT.constraints,
      examples: localDDT.examples,
      nlpContract: localDDT.nlpContract,
      introduction: localDDT.introduction
    };
  }

  // ✅ Struttura identica → salva solo override (logica: steps, constraints, examples, nlpContract)
  // Usa buildMainDataFromTemplate per ottenere templateNode con constraints/examples per confronto override
  const { mainData: templateMainDataForOverride } = buildMainDataFromTemplate(template);

  console.log('[extractModifiedDDTFields] ✅ Structure identical - extracting overrides only', {
    localMainDataLength: localDDT.mainData?.length || 0,
    templateMainDataForOverrideLength: templateMainDataForOverride.length
  });

  if (localDDT.mainData && Array.isArray(localDDT.mainData) && templateMainDataForOverride.length > 0) {
    const mainDataOverrides: any[] = [];

    for (let i = 0; i < localDDT.mainData.length; i++) {
      const mainNode = localDDT.mainData[i];
      const templateNode = templateMainDataForOverride[i] || templateMainDataForOverride[0]; // Fallback to first

      const templateNodeConstraints = templateNode?.dataContracts || templateNode?.constraints || [];
      const templateNodeExamples = templateNode?.examples || [];
      const templateNodeNlpContract = templateNode?.nlpContract;

      // ✅ CORRETTO: Leggi steps da instance.steps[nodeId], NON da mainNode.steps
      // Gli steps vivono solo in task.steps[nodeId], il DDT contiene solo la struttura
      const nodeId = mainNode.id;
      const nodeSteps = nodeId && instance.steps ? instance.steps[nodeId] : null;
      const hasSteps = nodeSteps && (
        (Array.isArray(nodeSteps) && nodeSteps.length > 0) ||
        (typeof nodeSteps === 'object' && Object.keys(nodeSteps).length > 0)
      );
      const hasConstraintsOverride = JSON.stringify(mainNode.constraints || []) !== JSON.stringify(templateNodeConstraints);
      const hasExamplesOverride = JSON.stringify(mainNode.examples || []) !== JSON.stringify(templateNodeExamples);
      const hasNlpContractOverride = JSON.stringify(mainNode.nlpContract) !== JSON.stringify(templateNodeNlpContract);

      console.log('[extractModifiedDDTFields] 🔍 Checking overrides for mainNode', {
        mainNodeIndex: i,
        mainNodeId: nodeId,
        hasSteps,
        hasConstraintsOverride,
        hasExamplesOverride,
        hasNlpContractOverride,
        stepsType: typeof nodeSteps,
        stepsIsArray: Array.isArray(nodeSteps),
        stepsKeys: typeof nodeSteps === 'object' ? Object.keys(nodeSteps || {}) : [],
        stepsLength: Array.isArray(nodeSteps) ? nodeSteps.length : 0
      });

      if (hasSteps || hasConstraintsOverride || hasExamplesOverride || hasNlpContractOverride) {
        const overrideNode: any = {
          templateId: mainNode.templateId || templateNode.templateId,
          label: mainNode.label
        };

        // ✅ CORRETTO: Salva steps in result.steps[nodeId] a root level, NON in overrideNode.steps
        // Gli steps vivono solo in task.steps[nodeId], non nel DDT
        if (hasSteps && nodeId) {
          if (!result.steps) result.steps = {};
          result.steps[nodeId] = nodeSteps;
          console.log('[extractModifiedDDTFields] ✅ Including steps in override', {
            mainNodeIndex: i,
            nodeId,
            stepsType: typeof nodeSteps,
            stepsIsArray: Array.isArray(nodeSteps),
            stepsKeys: typeof nodeSteps === 'object' ? Object.keys(nodeSteps || {}) : [],
            stepsLength: Array.isArray(nodeSteps) ? nodeSteps.length : 0
          });
        }
        if (hasConstraintsOverride) overrideNode.constraints = mainNode.constraints;
        if (hasExamplesOverride) overrideNode.examples = mainNode.examples;
        if (hasNlpContractOverride) overrideNode.nlpContract = mainNode.nlpContract;

        // Check subData overrides (solo logica, non struttura)
        if (mainNode.subData && Array.isArray(mainNode.subData) && templateNode.subData && Array.isArray(templateNode.subData)) {
          const subDataOverrides: any[] = [];
          for (const subNode of mainNode.subData) {
            const templateSubNode = templateNode.subData.find((s: any) =>
              s.templateId === subNode.templateId || s.label === subNode.label
            );

            if (templateSubNode) {
              const templateSubConstraints = templateSubNode.dataContracts || templateSubNode.constraints || [];
              const templateSubExamples = templateSubNode.examples || [];
              const templateSubNlpContract = templateSubNode.nlpContract;

              // ✅ CORRETTO: Leggi steps da instance.steps[subNodeId], NON da subNode.steps
              const subNodeId = subNode.id;
              const subNodeSteps = subNodeId && instance.steps ? instance.steps[subNodeId] : null;
              const hasSubSteps = subNodeSteps && (
                (Array.isArray(subNodeSteps) && subNodeSteps.length > 0) ||
                (typeof subNodeSteps === 'object' && Object.keys(subNodeSteps).length > 0)
              );
              const hasSubConstraintsOverride = JSON.stringify(subNode.constraints || []) !== JSON.stringify(templateSubConstraints);
              const hasSubExamplesOverride = JSON.stringify(subNode.examples || []) !== JSON.stringify(templateSubExamples);
              const hasSubNlpContractOverride = JSON.stringify(subNode.nlpContract) !== JSON.stringify(templateSubNlpContract);

              if (hasSubSteps || hasSubConstraintsOverride || hasSubExamplesOverride || hasSubNlpContractOverride) {
                const overrideSubNode: any = {
                  templateId: subNode.templateId || templateSubNode.templateId,
                  label: subNode.label
                };

                // ✅ CORRETTO: Salva steps in result.steps[subNodeId] a root level, NON in overrideSubNode.steps
                if (hasSubSteps && subNodeId) {
                  if (!result.steps) result.steps = {};
                  result.steps[subNodeId] = subNodeSteps;
                }
                if (hasSubConstraintsOverride) overrideSubNode.constraints = subNode.constraints;
                if (hasSubExamplesOverride) overrideSubNode.examples = subNode.examples;
                if (hasSubNlpContractOverride) overrideSubNode.nlpContract = subNode.nlpContract;

                subDataOverrides.push(overrideSubNode);
              }
            }
          }
          if (subDataOverrides.length > 0) {
            overrideNode.subData = subDataOverrides;
          }
        }

        mainDataOverrides.push(overrideNode);
      }
    }

    if (mainDataOverrides.length > 0) {
      result.mainData = mainDataOverrides;
      console.log('[extractModifiedDDTFields] ✅ Saving mainData overrides', {
        mainDataOverridesLength: mainDataOverrides.length,
        firstOverride: mainDataOverrides[0] ? {
          templateId: mainDataOverrides[0].templateId,
          label: mainDataOverrides[0].label,
          hasSteps: !!mainDataOverrides[0].steps,
          stepsType: typeof mainDataOverrides[0].steps,
          stepsKeys: typeof mainDataOverrides[0].steps === 'object' ? Object.keys(mainDataOverrides[0].steps || {}) : []
        } : null
      });
    } else {
      console.log('[extractModifiedDDTFields] ⚠️ No mainData overrides found - saving empty mainData array');
    }
  }

  // ✅ Confronta root-level constraints/examples/nlpContract/introduction
  // Salva solo se diversi dal template (override)
  const templateConstraints = template.dataContracts || template.constraints || [];
  const templateExamples = template.examples || [];
  const templateNlpContract = template.nlpContract;
  const templateIntroduction = template.introduction;

  if (JSON.stringify(localDDT.constraints || []) !== JSON.stringify(templateConstraints)) {
    result.constraints = localDDT.constraints;
  }

  if (JSON.stringify(localDDT.examples || []) !== JSON.stringify(templateExamples)) {
    result.examples = localDDT.examples;
  }

  if (JSON.stringify(localDDT.nlpContract) !== JSON.stringify(templateNlpContract)) {
    result.nlpContract = localDDT.nlpContract;
  }

  if (localDDT.introduction !== templateIntroduction) {
    result.introduction = localDDT.introduction;
  }

  console.log('[extractModifiedDDTFields] ✅ Final result', {
    hasLabel: !!result.label,
    hasMainData: !!result.mainData,
    mainDataLength: result.mainData?.length || 0,
    hasConstraints: !!result.constraints,
    hasExamples: !!result.examples,
    hasNlpContract: !!result.nlpContract,
    hasIntroduction: !!result.introduction,
    resultKeys: Object.keys(result)
  });

  return result;
}

