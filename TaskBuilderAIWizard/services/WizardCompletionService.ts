// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Completion Service
 *
 * Pure functions for wizard completion logic (template creation, instance creation, TaskTree building).
 * Extracted from useWizardCompletion hook to improve testability and separation of concerns.
 */

import type { WizardTaskTreeNode, WizardConstraint, WizardStepMessages } from '../types';
import type { DataContract } from '@components/DialogueDataEngine/parsers/contractLoader';
import type { SemanticContract } from '@types/semanticContract';
import type { DataContractItem } from '@components/DialogueDataEngine/parsers/contractLoader';
import { createTemplatesFromWizardData, createContextualizedInstance } from './TemplateCreationService';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { buildTaskTree } from '@utils/taskUtils';
import { flattenTaskTree } from '../utils/wizardHelpers';

/**
 * Collects constraints and data parsers from dataSchema into maps
 * Builds subDataMapping deterministically (s1, s2, s3...) for parent nodes
 */
export function collectNodeData(dataSchema: WizardTaskTreeNode[]): {
  constraintsMap: Map<string, WizardConstraint[]>;
  dataContractsMap: Map<string, DataContract>;
} {
  const constraintsMap = new Map<string, WizardConstraint[]>();
  const dataContractsMap = new Map<string, DataContract>();

  const collect = (nodes: WizardTaskTreeNode[]) => {
    nodes.forEach(node => {
      if (node.constraints && node.constraints.length > 0) {
        constraintsMap.set(node.id, node.constraints);
      }

      // ✅ CRITICAL: Build subDataMapping for parent nodes (deterministic: s1, s2, s3...)
      // This is needed by ALL engines (regex, llm, rules, ner) to map sub-node results
      let dataContract = node.dataContract;

      if (node.subNodes && node.subNodes.length > 0) {
        // Build subDataMapping from subNodes (deterministic based on position)
        const subDataMapping: Record<string, { groupName: string }> = {};
        node.subNodes.forEach((subNode, index) => {
          const groupName = `s${index + 1}`; // Deterministic: s1, s2, s3...
          subDataMapping[subNode.id] = {
            groupName
          };
        });

        // Initialize or update dataContract with subDataMapping
        if (!dataContract) {
          dataContract = {
            templateName: node.label || node.id,
            templateId: node.id,
            subDataMapping, // ✅ Always present for parent nodes
            parsers: [],
            testCases: [] // ✅ NEW: Initialize testCases at contract level
          };
        } else {
          // ✅ ALWAYS ensure subDataMapping is present and up-to-date
          // This is structural data needed by all engines
          dataContract.subDataMapping = subDataMapping;
          // ✅ Ensure testCases is initialized if not present
          if (!dataContract.testCases) {
            dataContract.testCases = [];
          }
        }
      } else {
        // Leaf nodes don't need subDataMapping (no sub-nodes)
        // But ensure dataContract exists if needed
        if (!dataContract) {
          dataContract = {
            templateName: node.label || node.id,
            templateId: node.id,
            subDataMapping: {}, // Empty for leaf nodes
            parsers: [],
            testCases: [] // ✅ NEW: Initialize testCases at contract level
          };
        } else {
          // ✅ Ensure testCases is initialized if not present
          if (!dataContract.testCases) {
            dataContract.testCases = [];
          }
        }
      }

      if (dataContract) {
        // ✅ DEBUG: Log quando collectNodeData raccoglie/crea il dataContract
        console.log(`[collectNodeData] ✅ ${node.dataContract ? 'Found' : 'Created'} dataContract for node "${node.label}" (${node.id})`, {
          nodeId: node.id,
          nodeLabel: node.label,
          wasCreated: !node.dataContract,
          hasContracts: !!dataContract.parsers,
          parsersIsArray: Array.isArray(dataContract.parsers),
          parsersCount: dataContract.parsers?.length || 0,
          contractTypes: dataContract.parsers?.map((c: any) => c.type) || [],
          fullDataContract: {
            templateName: dataContract.templateName,
            templateId: dataContract.templateId,
            subDataMappingKeys: Object.keys(dataContract.subDataMapping || {}),
            subDataMappingCount: Object.keys(dataContract.subDataMapping || {}).length,
            parsersCount: dataContract.parsers?.length || 0
          }
        });
        dataContractsMap.set(node.id, dataContract);
      }

      // Recursively collect from sub-nodes
      if (node.subNodes && node.subNodes.length > 0) {
        collect(node.subNodes);
      }
    });
  };

  collect(dataSchema);
  return { constraintsMap, dataContractsMap };
}

/**
 * Ensures all nodes have messages (creates empty messages if missing)
 */
function ensureAllNodesHaveMessages(
  dataSchema: WizardTaskTreeNode[],
  messagesToUse: Map<string, WizardStepMessages>
): void {
  const allNodes = flattenTaskTree(dataSchema);
  allNodes.forEach(node => {
    if (!messagesToUse.has(node.id)) {
      messagesToUse.set(node.id, {
        ask: { base: [] },
        confirm: { base: [] },
        notConfirmed: { base: [] },
        violation: { base: [] },
        disambiguation: { base: [], options: [] },
        success: { base: [] }
      });
    }
  });
}

/**
 * Creates templates from wizard data and registers them in memory
 */
async function createAndRegisterTemplates(
  dataSchema: WizardTaskTreeNode[],
  messagesToUse: Map<string, WizardStepMessages>,
  constraintsMap: Map<string, WizardConstraint[]>,
  dataContractsMap: Map<string, DataContract>,
  shouldBeGeneral: boolean,
  addTranslation?: (guid: string, text: string) => void
): Promise<{ templates: Map<string, any>; nodeIdToTemplateIdMap: Map<string, string> }> {
  const { templates, nodeIdToTemplateIdMap } = await createTemplatesFromWizardData(
    dataSchema,
    messagesToUse,
    constraintsMap,
    dataContractsMap,
    shouldBeGeneral,
    addTranslation
  );

  // Register templates in memory
  templates.forEach(template => {
    DialogueTaskService.addTemplate(template);

    // ✅ DEBUG: Log quando il template viene registrato in memoria
    console.log(`[createAndRegisterTemplates] ✅ Template registered in memory`, {
      templateId: template.id,
      templateLabel: template.label,
      hasDataContract: !!template.dataContract,
      parsersCount: template.dataContract?.parsers?.length || 0,
      contractTypes: template.dataContract?.parsers?.map((c: any) => c.type) || [],
      fullDataContract: template.dataContract ? {
        templateName: template.dataContract.templateName,
        templateId: template.dataContract.templateId,
        subDataMappingKeys: Object.keys(template.dataContract.subDataMapping || {}),
        parsersCount: template.dataContract.parsers?.length || 0,
        parsers: template.dataContract.parsers?.map((c: any) => ({
          type: c.type,
          enabled: c.enabled
        })) || []
      } : null
    });
  });

  return { templates, nodeIdToTemplateIdMap };
}

/**
 * Creates and saves a contextualized instance
 */
async function createAndSaveInstance(
  rootTemplate: any,
  templates: Map<string, any>,
  messagesContextualizedToUse: Map<string, WizardStepMessages>,
  taskLabel: string,
  rowId: string,
  projectId: string,
  addTranslation?: (guid: string, text: string) => void,
  adaptAllNormalSteps: boolean = false
): Promise<any> {
  // ✅ STEP 1: Verificare se istanza esiste già (con rowId)
  // Se esiste, NON creare nulla (per costruzione, istanza.id = row.id)
  let taskInstance = taskRepository.getTask(rowId);
  if (taskInstance) {
    console.log('[createAndSaveInstance] ✅ Istanza già esistente, non creare nulla', {
      rowId,
      taskId: taskInstance.id,
      templateId: taskInstance.templateId
    });
    return taskInstance;
  }

  // ✅ STEP 2: Validare rootTemplate
  if (!rootTemplate.id || rootTemplate.id === 'root' || rootTemplate.id === 'UNDEFINED') {
    throw new Error(`Invalid rootTemplate.id: ${rootTemplate.id}. Expected a valid GUID.`);
  }

  // ✅ STEP 3: Validare che rootTemplate.id ≠ rowId (per evitare duplicati)
  if (rootTemplate.id === rowId) {
    throw new Error(
      `[createAndSaveInstance] CRITICAL: rootTemplate.id (${rootTemplate.id}) cannot equal rowId (${rowId}). ` +
      `This would create a duplicate: instance.id === instance.templateId === template.id. ` +
      `Template must have a unique GUID different from instance ID.`
    );
  }

  // ✅ STEP 4: Creare istanza contestualizzata
  const instance = await createContextualizedInstance(
    rootTemplate,
    templates,
    messagesContextualizedToUse,
    taskLabel,
    rowId,
    addTranslation,
    adaptAllNormalSteps
  );

  // ✅ STEP 5: Creare task instance con istanza.id = rowId e templateId = rootTemplate.id
  // rootTemplate.id è ora un nuovo GUID (non node.id), quindi è sicuro
  taskInstance = taskRepository.createTask(
    TaskType.UtteranceInterpretation,
    rootTemplate.id, // ✅ Template ID (nuovo GUID, diverso da rowId)
    undefined,
    rowId, // ✅ Istanza ID = row.id (invariante)
    projectId
  );

  // ✅ STEP 6: Aggiornare task con dati dell'istanza
  taskRepository.updateTask(rowId, {
    ...instance,
    type: TaskType.UtteranceInterpretation,
    templateId: rootTemplate.id, // ✅ Template ID (nuovo GUID)
  }, projectId);

  // ✅ STEP 7: Ricaricare task instance dopo l'aggiornamento
  taskInstance = taskRepository.getTask(rowId);
  return taskInstance;
}

/**
 * Generates parsers for all nodes in a TaskTree
 * This is extracted to allow parsers to be generated before parser generation
 */
export async function generateContractsForTaskTree(
  taskTree: any
): Promise<Map<string, any>> {
  if (!taskTree) {
    return new Map();
  }

  try {
    const { generateContractsForAllNodes } = await import('@utils/wizard/generateContract');
    const generatedContracts = await generateContractsForAllNodes(taskTree);
    console.log('[WizardCompletionService] ✅ Contracts generated for TaskTree', {
      parsersCount: generatedContracts.size
    });
    return generatedContracts;
  } catch (contractError) {
    console.error('[WizardCompletionService] ❌ Error generating parsers', {
      error: contractError instanceof Error ? contractError.message : String(contractError)
    });
    return new Map();
  }
}

/**
 * Builds TaskTree and generates parsers/engines for all nodes
 */
export async function buildTaskTreeWithContractsAndEngines(
  taskInstance: any,
  projectId: string,
  dataSchema: WizardTaskTreeNode[]
): Promise<any> {
  // Build TaskTree
  const taskTree = await buildTaskTree(taskInstance, projectId);

  if (!taskTree) {
    return null;
  }

  // Generate parsers for all nodes
  const generatedContracts = await generateContractsForTaskTree(taskTree);

  // Generate engines and parsers for all nodes
  let engineConfigs = new Map<string, DataContractItem[]>();
  if (generatedContracts.size > 0 || taskTree.nodes) {
    try {
      const { generateEnginesAndParsersForAllNodes } = await import('@utils/wizard/generateEnginesAndParsers');
      engineConfigs = await generateEnginesAndParsersForAllNodes(taskTree, generatedContracts);
      console.log('[WizardCompletionService] ✅ Engine configs generated', {
        engineConfigsCount: engineConfigs.size
      });
    } catch (engineError) {
      // Non-blocking: log error but don't block wizard flow
      console.error('[WizardCompletionService] ❌ Error generating engines and parsers (non-blocking)', {
        error: engineError instanceof Error ? engineError.message : String(engineError)
      });
    }
  }

  // ✅ FASE 4: Assemble dataContract using Assembler (base + semantic + engines)
  // Collect base dataContracts from templates (already created by collectNodeData)
  const allNodeIds = new Set<string>();
  const collectNodeIds = (nodes: any[]) => {
    nodes.forEach(node => {
      const nodeId = node.id || node.templateId;
      if (nodeId) {
        allNodeIds.add(nodeId);
      }
      if (node.subNodes && Array.isArray(node.subNodes)) {
        collectNodeIds(node.subNodes);
      }
    });
  };
  if (taskTree?.nodes) {
    collectNodeIds(taskTree.nodes);
  }

  // Assemble dataContract for each node
  for (const nodeId of allNodeIds) {
    const template = DialogueTaskService.getTemplate(nodeId);
    if (!template) {
      continue;
    }

    // Get base (from template.dataContract created by collectNodeData)
    const base = template.dataContract;
    if (!base) {
      // ✅ Should not happen: base is created by collectNodeData in createTemplateAndInstanceForCompleted
      console.error(`[buildTaskTreeWithContractsAndEngines] ❌ Node ${nodeId} has no base dataContract - this should not happen`);
      continue;
    }

    // Get semantic (from generatedContracts)
    const semantic = generatedContracts.get(nodeId) || null;

    // Get engines (from engineConfigs)
    const engines = engineConfigs.get(nodeId) || [];

    // ✅ Assemble using Assembler (UNICO punto di merge)
    const assembled = assembleDataContract(base, semantic, engines);

    // ✅ Update template.dataContract with assembled result (UNICO punto di modifica)
    template.dataContract = assembled;
    DialogueTaskService.markTemplateAsModified(nodeId);

    console.log(`[buildTaskTreeWithContractsAndEngines] ✅ Assembled dataContract for node ${nodeId}`, {
      hasSubDataMapping: Object.keys(assembled.subDataMapping || {}).length > 0,
      subDataMappingKeys: Object.keys(assembled.subDataMapping || {}),
      parsersCount: assembled.parsers.length,
      contractTypes: assembled.parsers.map(c => c.type),
      hasSemantic: !!semantic
    });
  }

  return taskTree;
}

/**
 * Assembler: Unico punto di merge per dataContract
 *
 * ARCHITETTURA:
 * - Wizard costruisce base (templateName, templateId, subDataMapping, parsers: [])
 * - Semantic Builder produce semantic (entity, subentities, outputCanonical, ecc.)
 * - AI Engines produce engines (regex, llm, rules, ecc.)
 * - Assembler unisce tutto in dataContract finale
 *
 * VINCOLI:
 * - subDataMapping viene SEMPRE preservato da base (mai sovrascritto)
 * - parsers viene mergeato (base.parsers + engines)
 * - semantic fields vengono aggiunti senza toccare base fields
 */
function assembleDataContract(
  base: DataContract,
  semantic: SemanticContract | null,
  engines: DataContractItem[]
): DataContract {
  // ✅ CRITICAL: subDataMapping viene SEMPRE da base (deterministico, mai sovrascritto)
  const subDataMapping = base.subDataMapping || {};

  // ✅ Merge parsers: base.parsers (vuoto inizialmente) + engines (da AI)
  const parsers = [...(base.parsers || []), ...engines];

  // ✅ Assemble final dataContract
  const assembled: DataContract = {
    ...base,              // ✅ Preserva templateName, templateId, subDataMapping, parsers base
    ...(semantic || {}),  // ✅ Aggiunge entity, subentities, outputCanonical, constraints, ecc.
    subDataMapping,       // ✅ CRITICAL: Sempre da base, mai da semantic
    parsers,            // ✅ Merge: base + engines
    // ✅ NEW: testCases at contract level (initialize if not present)
    testCases: base.testCases || []
  };

  // ✅ Validation: Log warning se subDataMapping è vuoto per nodi con subNodes
  if (Object.keys(subDataMapping).length === 0 && parsers.length > 0) {
    console.warn(`[assembleDataContract] ⚠️ Node ${base.templateId} has empty subDataMapping but has parsers`);
  }

  return assembled;
}

/**
 * Creates template and instance for proposed structure (first step)
 */
export async function createTemplateAndInstanceForProposed(
  dataSchema: WizardTaskTreeNode[],
  messages: Map<string, WizardStepMessages>,
  messagesGeneralized: Map<string, WizardStepMessages>,
  messagesContextualized: Map<string, WizardStepMessages>,
  shouldBeGeneral: boolean,
  taskLabel: string,
  rowId: string,
  projectId: string,
  addTranslation?: (guid: string, text: string) => void,
  adaptAllNormalSteps: boolean = false
): Promise<{ taskInstance: any; taskTree: any | null }> {
  // Validate inputs
  if (dataSchema.length === 0) {
    throw new Error('[WizardCompletionService] dataSchema is empty');
  }

  if (!rowId) {
    throw new Error('[WizardCompletionService] rowId is required');
  }

  // 1. Collect constraints and data parsers
  const { constraintsMap, dataContractsMap } = collectNodeData(dataSchema);

  // 2. Use generalized messages if available, otherwise use normal messages
  const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

  // 3. Ensure all nodes have messages (create empty if missing)
  ensureAllNodesHaveMessages(dataSchema, messagesToUse);

  // 4. Use contextualized messages if available, otherwise use normal messages
  const messagesContextualizedToUse = messagesContextualized.size > 0 ? messagesContextualized : messages;

  // 5. Create and register templates
  const { templates, nodeIdToTemplateIdMap } = await createAndRegisterTemplates(
    dataSchema,
    messagesToUse,
    constraintsMap,
    dataContractsMap,
    shouldBeGeneral,
    addTranslation
  );

  // 6. Get root template using mapping
  const rootNode = dataSchema[0];
  const rootTemplateId = nodeIdToTemplateIdMap.get(rootNode.id);

  if (!rootTemplateId) {
    throw new Error(`[WizardCompletionService] Root template ID not found in mapping for node.id: ${rootNode.id}`);
  }

  const rootTemplate = templates.get(rootTemplateId);

  if (!rootTemplate) {
    throw new Error(`[WizardCompletionService] Root template not found for template.id: ${rootTemplateId}`);
  }

  // 7. Create and save instance
  const taskInstance = await createAndSaveInstance(
    rootTemplate,
    templates,
    messagesContextualizedToUse,
    taskLabel,
    rowId,
    projectId,
    addTranslation,
    adaptAllNormalSteps
  );

  // 8. Build TaskTree (without parsers/engines - they will be generated separately)
  let taskTree: any | null = null;
  try {
    taskTree = await buildTaskTree(taskInstance, projectId);

    // 9. Generate parsers for all nodes (CRITICAL: must be done before parser generation)
    if (taskTree) {
      await generateContractsForTaskTree(taskTree);
    }
  } catch (error) {
    // Non-blocking: log error but don't block wizard flow
    console.error('[WizardCompletionService] ❌ Error building TaskTree or generating parsers (non-blocking)', {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return { taskInstance, taskTree };
}

/**
 * Creates template and instance for completed wizard
 */
export async function createTemplateAndInstanceForCompleted(
  dataSchema: WizardTaskTreeNode[],
  messages: Map<string, WizardStepMessages>,
  messagesGeneralized: Map<string, WizardStepMessages>,
  messagesContextualized: Map<string, WizardStepMessages>,
  shouldBeGeneral: boolean,
  taskLabel: string,
  rowId: string,
  projectId: string,
  addTranslation?: (guid: string, text: string) => void,
  adaptAllNormalSteps: boolean = false
): Promise<any> {
  // Validate inputs
  if (dataSchema.length === 0) {
    throw new Error('[WizardCompletionService] dataSchema is empty');
  }

  if (!rowId) {
    throw new Error('[WizardCompletionService] rowId is required');
  }

  // ✅ DEBUG: Verifica stato dataSchema PRIMA di collectNodeData
  const allNodesBefore = flattenTaskTree(dataSchema);
  console.log(`[createTemplateAndInstanceForCompleted] 🔍 DATA SCHEMA STATE BEFORE collectNodeData`, {
    totalNodes: allNodesBefore.length,
    nodesWithDataContract: allNodesBefore.filter(n => !!n.dataContract).length,
    nodesWithContracts: allNodesBefore.filter(n => n.dataContract?.parsers && n.dataContract.parsers.length > 0).length,
    nodesDetails: allNodesBefore.map(n => ({
      nodeId: n.id,
      nodeLabel: n.label,
      hasDataContract: !!n.dataContract,
      parsersCount: n.dataContract?.parsers?.length || 0,
      contractTypes: n.dataContract?.parsers?.map((c: any) => c.type) || [],
      dataContractKeys: n.dataContract ? Object.keys(n.dataContract) : []
    }))
  });

  // 1. Collect constraints and data parsers
  const { constraintsMap, dataContractsMap } = collectNodeData(dataSchema);

  // ✅ DEBUG: Verifica cosa è stato raccolto
  console.log(`[createTemplateAndInstanceForCompleted] 🔍 COLLECTED DATA`, {
    constraintsMapSize: constraintsMap.size,
    dataContractsMapSize: dataContractsMap.size,
    dataContractsMapKeys: Array.from(dataContractsMap.keys()),
    dataContractsDetails: Array.from(dataContractsMap.entries()).map(([nodeId, contract]) => ({
      nodeId,
      hasContract: !!contract,
      parsersCount: contract?.parsers?.length || 0,
      contractTypes: contract?.parsers?.map((c: any) => c.type) || [],
      contractKeys: contract ? Object.keys(contract) : []
    }))
  });

  // 2. Use generalized messages if available, otherwise use normal messages
  const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

  // 3. Verify all nodes have messages (required for completion)
  const allNodes = flattenTaskTree(dataSchema);
  const nodesWithoutMessages = allNodes.filter(node => !messagesToUse.has(node.id));

  if (nodesWithoutMessages.length > 0) {
    throw new Error(
      `Cannot create templates: ${nodesWithoutMessages.length} nodes are missing messages. ` +
      `Nodes: ${nodesWithoutMessages.map(n => n.label).join(', ')}.`
    );
  }

  // 4. Use contextualized messages if available, otherwise use normal messages
  const messagesContextualizedToUse = messagesContextualized.size > 0 ? messagesContextualized : messages;

  // 5. Create and register templates
  const { templates, nodeIdToTemplateIdMap } = await createAndRegisterTemplates(
    dataSchema,
    messagesToUse,
    constraintsMap,
    dataContractsMap,
    shouldBeGeneral,
    addTranslation
  );

  // 6. Get root template using mapping
  const rootNode = dataSchema[0];
  const rootTemplateId = nodeIdToTemplateIdMap.get(rootNode.id);

  if (!rootTemplateId) {
    throw new Error(`[WizardCompletionService] Root template ID not found in mapping for node.id: ${rootNode.id}`);
  }

  const rootTemplate = templates.get(rootTemplateId);

  if (!rootTemplate) {
    throw new Error(`[WizardCompletionService] Root template not found for template.id: ${rootTemplateId}`);
  }

  // 7. Create and save instance
  const taskInstance = await createAndSaveInstance(
    rootTemplate,
    templates,
    messagesContextualizedToUse,
    taskLabel,
    rowId,
    projectId,
    addTranslation,
    adaptAllNormalSteps
  );

  return taskInstance;
}
