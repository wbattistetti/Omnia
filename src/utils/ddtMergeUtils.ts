import type { Task } from '../types/taskTypes';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Build complete DDT from template (reference) and instance (steps + overrides)
 *
 * Rules:
 * - label, steps: Always from instance (always editable)
 * - mainData structure: Replicated in instance (for allowing additions), but contracts/constraints come from template (reference)
 * - constraints, examples, nlpContract: From template (reference), unless overridden in instance
 *
 * Structure:
 * - Nodes with templateId !== null: Structure from template, steps cloned with new task IDs, contracts from template
 * - Nodes with templateId === null: Complete structure from instance (added nodes)
 */
export async function buildDDTFromTemplate(instance: Task | null): Promise<any | null> {
  if (!instance) return null;

  // If no templateId or templateId is "UNDEFINED", this is a standalone instance (has full structure)
  // "UNDEFINED" is a placeholder for tasks that haven't been typed yet, not a real template
  if (!instance.templateId || instance.templateId === 'UNDEFINED') {
    return {
      label: instance.label,
      mainData: instance.mainData || [],
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
      // Clone main node steps (if not already cloned by buildMainDataFromTemplate)
      let clonedMainSteps = templateNode.steps;
      if (templateNode.steps) {
        const { cloned, guidMapping } = cloneStepsWithNewTaskIds(templateNode.steps);
        guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
        clonedMainSteps = cloned;
      }

      // Clone sub-data steps (if not already cloned by buildMainDataFromTemplate)
      const enrichedSubData = (templateNode.subData || []).map((subNode: any) => {
        if (subNode.steps) {
          const { cloned, guidMapping: subGuidMapping } = cloneStepsWithNewTaskIds(subNode.steps);
          subGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
          return {
            ...subNode,
            steps: cloned
          };
        }
        return subNode;
      });

      return {
        ...templateNode,
        steps: clonedMainSteps,
        subData: enrichedSubData
      };
    });

    const result = {
      label: instance.label ?? template.label,
      mainData: enrichedMainData,
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
        // ✅ Clone steps from template with new task IDs, or use steps from instance if modified
        const steps = instanceNode.steps ?? (templateNode.steps ? cloneStepsWithNewTaskIds(templateNode.steps) : undefined);

        return {
          ...templateNode,  // ✅ Structure from template (includes contracts/constraints)
          steps: steps,  // ✅ Clone steps with new task IDs
          // ✅ Enrich subData recursively
          subData: enrichSubDataFromInstance(instanceNode.subData || [], templateNode.subData || [])
        };
      } else {
        // Template node not found, use instance node as-is (fallback)
        return instanceNode;
      }
    } else {
      // ✅ NODE ADDED IN INSTANCE (templateId === null): use complete structure from instance
      return instanceNode;  // ✅ Complete structure copied
    }
  });

  // Root level: use instance if present (override), otherwise template
  const result = {
    label: instance.label ?? template.label,
    mainData: enrichedMainData,
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
 * Checks if template has mainData with steps, otherwise builds from subDataIds
 * Returns both mainData and guidMapping for translation copying
 */
export function buildMainDataFromTemplate(template: any): { mainData: any[]; guidMapping: Map<string, string> } {
  const allGuidMappings = new Map<string, string>();

  // ✅ Check if template has mainData with steps already assembled
  if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
    // Template has mainData with steps - clone with new IDs and collect mappings
    const mainData = template.mainData.map((mainNode: any) => {
      let clonedMainSteps = mainNode.steps;
      if (mainNode.steps) {
        const { cloned, guidMapping } = cloneStepsWithNewTaskIds(mainNode.steps);
        guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
        clonedMainSteps = cloned;
      }

      const subData = (mainNode.subData || []).map((subNode: any) => {
        let clonedSubSteps = subNode.steps;
        if (subNode.steps) {
          const { cloned, guidMapping: subGuidMapping } = cloneStepsWithNewTaskIds(subNode.steps);
          subGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
          clonedSubSteps = cloned;
        }
        return {
          ...subNode,
          steps: clonedSubSteps
        };
      });

      return {
        ...mainNode,
        steps: clonedMainSteps,
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
        // ✅ Check if subTemplate has mainData with steps
        let subSteps = undefined;
        if (subTemplate.mainData && Array.isArray(subTemplate.mainData) && subTemplate.mainData.length > 0) {
          subSteps = subTemplate.mainData[0].steps;
        } else if (subTemplate.steps) {
          subSteps = subTemplate.steps;
        }

        // Clone sub steps and collect mappings
        let clonedSubSteps = subSteps;
        if (subSteps) {
          const { cloned, guidMapping: subGuidMapping } = cloneStepsWithNewTaskIds(subSteps);
          subGuidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(oldGuid, newGuid));
          clonedSubSteps = cloned;
        }

        subDataInstances.push({
          id: subTemplate.id || subTemplate._id,
          label: subTemplate.label || subTemplate.name || 'Sub',
          type: subTemplate.type,
          icon: subTemplate.icon || 'FileText',
          steps: clonedSubSteps,
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          examples: subTemplate.examples || [],
          nlpContract: subTemplate.nlpContract || undefined,
          subData: [],
          templateId: subTemplate.id || subTemplate._id,
          kind: subTemplate.name || subTemplate.type || 'generic'
        });
      }
    }

    // ✅ Check if template has steps at root level
    let mainSteps = undefined;
    if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
      mainSteps = template.mainData[0].steps;
    } else if (template.steps) {
      mainSteps = template.steps;
    }

    // Clone main steps and collect mappings
    let clonedMainSteps = mainSteps;
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
      steps: clonedMainSteps,
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
    // ✅ Check if template has steps at root level
    let mainSteps = undefined;
    if (template.mainData && Array.isArray(template.mainData) && template.mainData.length > 0) {
      mainSteps = template.mainData[0].steps;
    } else if (template.steps) {
      mainSteps = template.steps;
    }

    // Clone main steps and collect mappings
    let clonedMainSteps = mainSteps;
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
        steps: clonedMainSteps,
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
        } catch {}
        if (!projectId) {
          try {
            const runtime = await import('../state/runtime');
            projectId = runtime.getCurrentProjectId();
          } catch {}
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
 * Extract only modified fields from DDT (compared to template)
 * Returns DDT with only fields that differ from template (label, steps always included)
 * constraints/examples/nlpContract/introduction only included if they differ from template
 *
 * LOGICA CONCETTUALE:
 * - Template: contiene struttura condivisa (constraints, examples, nlpContract, introduction)
 * - Istanza: contiene SOLO override (modifiche rispetto al template)
 * - A runtime: se mancante nell'istanza → risoluzione lazy dal template (backend VB.NET)
 * - NO fallback: se template non trovato → salva tutto (non può risolvere lazy)
 *
 * VANTAGGI:
 * - Elimina duplicazione: stesso contract salvato N volte per N istanze
 * - Aggiornamenti centralizzati: cambi template → tutte istanze usano nuovo contract
 * - Performance: meno dati nel database, lookup template in memoria (O(1))
 */
export async function extractModifiedDDTFields(instance: Task | null, localDDT: any): Promise<Partial<Task>> {
  if (!instance || !localDDT) {
    return localDDT || {};
  }

  // ✅ Se no templateId, questo è un template o istanza standalone → salva tutto
  // (non c'è template da cui risolvere lazy)
  if (!instance.templateId) {
    return {
      label: localDDT.label,
      mainData: localDDT.mainData,
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
    // NO fallback: questo è un errore che deve essere visibile
    console.warn(`[extractModifiedDDTFields] Template ${instance.templateId} not found - saving everything (cannot resolve lazy)`);
    return {
      label: localDDT.label,
      mainData: localDDT.mainData,
      constraints: localDDT.constraints,
      examples: localDDT.examples,
      nlpContract: localDDT.nlpContract,
      introduction: localDDT.introduction
    };
  }

  // ✅ Salva sempre label (sempre modificabile)
  // ✅ mainData: salva solo se contiene override (steps, constraints, examples, nlpContract)
  // Struttura (label, type, icon) viene dal template (referenza via templateId)
  const result: Partial<Task> = {
    label: localDDT.label
  };

  // ✅ Build template structure to compare
  const { mainData: templateMainDataArray } = buildMainDataFromTemplate(template);

  // ✅ Save mainData only if it contains overrides (stepPrompts, constraints, examples, nlpContract)
  // Structure is not saved, only overrides
  if (localDDT.mainData && Array.isArray(localDDT.mainData) && templateMainDataArray.length > 0) {
    const mainDataOverrides: any[] = [];

    for (let i = 0; i < localDDT.mainData.length; i++) {
      const mainNode = localDDT.mainData[i];
      const templateNode = templateMainDataArray[i] || templateMainDataArray[0]; // Fallback to first

      const templateNodeConstraints = templateNode?.dataContracts || templateNode?.constraints || [];
      const templateNodeExamples = templateNode?.examples || [];
      const templateNodeNlpContract = templateNode?.nlpContract;

      // Check if node has any overrides
      const hasStepsOverride = mainNode.steps && JSON.stringify(mainNode.steps) !== JSON.stringify(templateNode?.steps);
      const hasConstraintsOverride = JSON.stringify(mainNode.constraints || []) !== JSON.stringify(templateNodeConstraints);
      const hasExamplesOverride = JSON.stringify(mainNode.examples || []) !== JSON.stringify(templateNodeExamples);
      const hasNlpContractOverride = JSON.stringify(mainNode.nlpContract) !== JSON.stringify(templateNodeNlpContract);

      if (hasStepsOverride || hasConstraintsOverride || hasExamplesOverride || hasNlpContractOverride) {
        const overrideNode: any = {
          templateId: mainNode.templateId || templateNode.templateId,
          label: mainNode.label
        };

        if (hasStepsOverride) overrideNode.steps = mainNode.steps;
        if (hasConstraintsOverride) overrideNode.constraints = mainNode.constraints;
        if (hasExamplesOverride) overrideNode.examples = mainNode.examples;
        if (hasNlpContractOverride) overrideNode.nlpContract = mainNode.nlpContract;

        // Check subData overrides
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

              const hasSubStepsOverride = subNode.steps && JSON.stringify(subNode.steps) !== JSON.stringify(templateSubNode.steps);
              const hasSubConstraintsOverride = JSON.stringify(subNode.constraints || []) !== JSON.stringify(templateSubConstraints);
              const hasSubExamplesOverride = JSON.stringify(subNode.examples || []) !== JSON.stringify(templateSubExamples);
              const hasSubNlpContractOverride = JSON.stringify(subNode.nlpContract) !== JSON.stringify(templateSubNlpContract);

              if (hasSubStepsOverride || hasSubConstraintsOverride || hasSubExamplesOverride || hasSubNlpContractOverride) {
                const overrideSubNode: any = {
                  templateId: subNode.templateId || templateSubNode.templateId,
                  label: subNode.label
                };

                if (hasSubStepsOverride) overrideSubNode.steps = subNode.steps;
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

  return result;
}

