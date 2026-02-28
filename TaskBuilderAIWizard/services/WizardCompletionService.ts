// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Completion Service
 *
 * Pure functions for wizard completion logic (template creation, instance creation, TaskTree building).
 * Extracted from useWizardCompletion hook to improve testability and separation of concerns.
 */

import type { WizardTaskTreeNode, WizardConstraint, WizardStepMessages } from '../types';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import type { SemanticContract } from '@types/semanticContract';
import type { DataContractItem } from '@components/DialogueDataEngine/contracts/contractLoader';
import { createTemplatesFromWizardData, createContextualizedInstance } from './TemplateCreationService';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { buildTaskTree } from '@utils/taskUtils';
import { flattenTaskTree } from '../utils/wizardHelpers';

/**
 * Collects constraints and data contracts from dataSchema into maps
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
            contracts: []
          };
        } else {
          // ✅ ALWAYS ensure subDataMapping is present and up-to-date
          // This is structural data needed by all engines
          dataContract.subDataMapping = subDataMapping;
        }
      } else {
        // Leaf nodes don't need subDataMapping (no sub-nodes)
        // But ensure dataContract exists if needed
        if (!dataContract) {
          dataContract = {
            templateName: node.label || node.id,
            templateId: node.id,
            subDataMapping: {}, // Empty for leaf nodes
            contracts: []
          };
        }
      }

      if (dataContract) {
        // ✅ DEBUG: Log quando collectNodeData raccoglie/crea il dataContract
        console.log(`[collectNodeData] ✅ ${node.dataContract ? 'Found' : 'Created'} dataContract for node "${node.label}" (${node.id})`, {
          nodeId: node.id,
          nodeLabel: node.label,
          wasCreated: !node.dataContract,
          hasContracts: !!dataContract.contracts,
          contractsIsArray: Array.isArray(dataContract.contracts),
          contractsCount: dataContract.contracts?.length || 0,
          contractTypes: dataContract.contracts?.map((c: any) => c.type) || [],
          fullDataContract: {
            templateName: dataContract.templateName,
            templateId: dataContract.templateId,
            subDataMappingKeys: Object.keys(dataContract.subDataMapping || {}),
            subDataMappingCount: Object.keys(dataContract.subDataMapping || {}).length,
            contractsCount: dataContract.contracts?.length || 0
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
): Promise<Map<string, any>> {
  const templates = await createTemplatesFromWizardData(
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
      contractsCount: template.dataContract?.contracts?.length || 0,
      contractTypes: template.dataContract?.contracts?.map((c: any) => c.type) || [],
      fullDataContract: template.dataContract ? {
        templateName: template.dataContract.templateName,
        templateId: template.dataContract.templateId,
        subDataMappingKeys: Object.keys(template.dataContract.subDataMapping || {}),
        contractsCount: template.dataContract.contracts?.length || 0,
        contracts: template.dataContract.contracts?.map((c: any) => ({
          type: c.type,
          enabled: c.enabled
        })) || []
      } : null
    });
  });

  return templates;
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
  // Validate rootNode
  if (!rootTemplate.id || rootTemplate.id === 'root' || rootTemplate.id === 'UNDEFINED') {
    throw new Error(`Invalid rootTemplate.id: ${rootTemplate.id}. Expected a valid GUID.`);
  }

  // Create contextualized instance
  const instance = await createContextualizedInstance(
    rootTemplate,
    templates,
    messagesContextualizedToUse,
    taskLabel,
    rowId,
    addTranslation,
    adaptAllNormalSteps
  );

  // Get or create task instance
  let taskInstance = taskRepository.getTask(rowId);
  if (!taskInstance) {
    taskInstance = taskRepository.createTask(
      TaskType.UtteranceInterpretation,
      rootTemplate.id,
      undefined,
      rowId,
      projectId
    );
  }

  // Update task with instance data
  taskRepository.updateTask(rowId, {
    ...instance,
    type: TaskType.UtteranceInterpretation,
    templateId: rootTemplate.id,
  }, projectId);

  // Reload task instance after update
  taskInstance = taskRepository.getTask(rowId);
  return taskInstance;
}

/**
 * Generates contracts for all nodes in a TaskTree
 * This is extracted to allow contracts to be generated before parser generation
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
      contractsCount: generatedContracts.size
    });
    return generatedContracts;
  } catch (contractError) {
    console.error('[WizardCompletionService] ❌ Error generating contracts', {
      error: contractError instanceof Error ? contractError.message : String(contractError)
    });
    return new Map();
  }
}

/**
 * Builds TaskTree and generates contracts/engines for all nodes
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

  // Generate contracts for all nodes
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
      contractsCount: assembled.contracts.length,
      contractTypes: assembled.contracts.map(c => c.type),
      hasSemantic: !!semantic
    });
  }

  return taskTree;
}

/**
 * Assembler: Unico punto di merge per dataContract
 *
 * ARCHITETTURA:
 * - Wizard costruisce base (templateName, templateId, subDataMapping, contracts: [])
 * - Semantic Builder produce semantic (entity, subentities, outputCanonical, ecc.)
 * - AI Engines produce engines (regex, llm, rules, ecc.)
 * - Assembler unisce tutto in dataContract finale
 *
 * VINCOLI:
 * - subDataMapping viene SEMPRE preservato da base (mai sovrascritto)
 * - contracts viene mergeato (base.contracts + engines)
 * - semantic fields vengono aggiunti senza toccare base fields
 */
function assembleDataContract(
  base: DataContract,
  semantic: SemanticContract | null,
  engines: DataContractItem[]
): DataContract {
  // ✅ CRITICAL: subDataMapping viene SEMPRE da base (deterministico, mai sovrascritto)
  const subDataMapping = base.subDataMapping || {};

  // ✅ Merge contracts: base.contracts (vuoto inizialmente) + engines (da AI)
  const contracts = [...(base.contracts || []), ...engines];

  // ✅ Assemble final dataContract
  const assembled: DataContract = {
    ...base,              // ✅ Preserva templateName, templateId, subDataMapping, contracts base
    ...(semantic || {}),  // ✅ Aggiunge entity, subentities, outputCanonical, constraints, ecc.
    subDataMapping,       // ✅ CRITICAL: Sempre da base, mai da semantic
    contracts             // ✅ Merge: base + engines
  };

  // ✅ Validation: Log warning se subDataMapping è vuoto per nodi con subNodes
  if (Object.keys(subDataMapping).length === 0 && contracts.length > 0) {
    console.warn(`[assembleDataContract] ⚠️ Node ${base.templateId} has empty subDataMapping but has contracts`);
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

  // 1. Collect constraints and data contracts
  const { constraintsMap, dataContractsMap } = collectNodeData(dataSchema);

  // 2. Use generalized messages if available, otherwise use normal messages
  const messagesToUse = messagesGeneralized.size > 0 ? messagesGeneralized : messages;

  // 3. Ensure all nodes have messages (create empty if missing)
  ensureAllNodesHaveMessages(dataSchema, messagesToUse);

  // 4. Use contextualized messages if available, otherwise use normal messages
  const messagesContextualizedToUse = messagesContextualized.size > 0 ? messagesContextualized : messages;

  // 5. Create and register templates
  const templates = await createAndRegisterTemplates(
    dataSchema,
    messagesToUse,
    constraintsMap,
    dataContractsMap,
    shouldBeGeneral,
    addTranslation
  );

  // 6. Get root template
  const rootNode = dataSchema[0];
  const rootNodeTemplateId = rootNode.id;
  const rootTemplate = templates.get(rootNodeTemplateId);

  if (!rootTemplate) {
    throw new Error(`[WizardCompletionService] Root template not found for id: ${rootNodeTemplateId}`);
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

  // 8. Build TaskTree (without contracts/engines - they will be generated separately)
  let taskTree: any | null = null;
  try {
    taskTree = await buildTaskTree(taskInstance, projectId);

    // 9. Generate contracts for all nodes (CRITICAL: must be done before parser generation)
    if (taskTree) {
      await generateContractsForTaskTree(taskTree);
    }
  } catch (error) {
    // Non-blocking: log error but don't block wizard flow
    console.error('[WizardCompletionService] ❌ Error building TaskTree or generating contracts (non-blocking)', {
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
    nodesWithContracts: allNodesBefore.filter(n => n.dataContract?.contracts && n.dataContract.contracts.length > 0).length,
    nodesDetails: allNodesBefore.map(n => ({
      nodeId: n.id,
      nodeLabel: n.label,
      hasDataContract: !!n.dataContract,
      contractsCount: n.dataContract?.contracts?.length || 0,
      contractTypes: n.dataContract?.contracts?.map((c: any) => c.type) || [],
      dataContractKeys: n.dataContract ? Object.keys(n.dataContract) : []
    }))
  });

  // 1. Collect constraints and data contracts
  const { constraintsMap, dataContractsMap } = collectNodeData(dataSchema);

  // ✅ DEBUG: Verifica cosa è stato raccolto
  console.log(`[createTemplateAndInstanceForCompleted] 🔍 COLLECTED DATA`, {
    constraintsMapSize: constraintsMap.size,
    dataContractsMapSize: dataContractsMap.size,
    dataContractsMapKeys: Array.from(dataContractsMap.keys()),
    dataContractsDetails: Array.from(dataContractsMap.entries()).map(([nodeId, contract]) => ({
      nodeId,
      hasContract: !!contract,
      contractsCount: contract?.contracts?.length || 0,
      contractTypes: contract?.contracts?.map((c: any) => c.type) || [],
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
  const templates = await createAndRegisterTemplates(
    dataSchema,
    messagesToUse,
    constraintsMap,
    dataContractsMap,
    shouldBeGeneral,
    addTranslation
  );

  // 6. Get root template
  const rootNode = dataSchema[0];

  // Validate rootNode.id === rootNode.templateId
  if (rootNode.id !== rootNode.templateId) {
    throw new Error(
      `[WizardCompletionService] CRITICAL: rootNode.id (${rootNode.id}) !== rootNode.templateId (${rootNode.templateId})`
    );
  }

  const rootNodeTemplateId = rootNode.id;
  const rootTemplate = templates.get(rootNodeTemplateId);

  if (!rootTemplate) {
    throw new Error(
      `[WizardCompletionService] CRITICAL: Root template not found for id: ${rootNodeTemplateId}`
    );
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
