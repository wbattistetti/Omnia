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
import { createTemplatesFromWizardData, createContextualizedInstance } from './TemplateCreationService';
import { DialogueTaskService } from '@services/DialogueTaskService';
import { taskRepository } from '@services/TaskRepository';
import { TaskType } from '@types/taskTypes';
import { buildTaskTree } from '@utils/taskUtils';
import { flattenTaskTree } from '../utils/wizardHelpers';

/**
 * Collects constraints and data contracts from dataSchema into maps
 */
function collectNodeData(dataSchema: WizardTaskTreeNode[]): {
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
      // ✅ node.dataContract is already DataContract (no conversion needed)
      if (node.dataContract) {
        dataContractsMap.set(node.id, node.dataContract);
      }
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
function createAndRegisterTemplates(
  dataSchema: WizardTaskTreeNode[],
  messagesToUse: Map<string, WizardStepMessages>,
  constraintsMap: Map<string, WizardConstraint[]>,
  dataContractsMap: Map<string, DataContract>,
  shouldBeGeneral: boolean,
  addTranslation?: (guid: string, text: string) => void
): Map<string, any> {
  const templates = createTemplatesFromWizardData(
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
  try {
    const { generateContractsForAllNodes } = await import('@utils/wizard/generateContract');
    const generatedContracts = await generateContractsForAllNodes(taskTree);

    // Generate engines and parsers for all nodes
    if (generatedContracts.size > 0 || taskTree.nodes) {
      try {
        const { generateEnginesAndParsersForAllNodes } = await import('@utils/wizard/generateEnginesAndParsers');
        await generateEnginesAndParsersForAllNodes(taskTree, generatedContracts);
      } catch (engineError) {
        // Non-blocking: log error but don't block wizard flow
        console.error('[WizardCompletionService] ❌ Error generating engines and parsers (non-blocking)', {
          error: engineError instanceof Error ? engineError.message : String(engineError)
        });
      }
    }
  } catch (contractError) {
    // Non-blocking: log error but don't block wizard flow
    console.error('[WizardCompletionService] ❌ Error generating contracts (non-blocking)', {
      error: contractError instanceof Error ? contractError.message : String(contractError)
    });
  }

  return taskTree;
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
  const templates = createAndRegisterTemplates(
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

  // 8. Build TaskTree and generate contracts/engines
  let taskTree: any | null = null;
  try {
    taskTree = await buildTaskTreeWithContractsAndEngines(taskInstance, projectId, dataSchema);
  } catch (error) {
    // Non-blocking: log error but don't block wizard flow
    console.error('[WizardCompletionService] ❌ Error building TaskTree (non-blocking)', {
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

  // 1. Collect constraints and data contracts
  const { constraintsMap, dataContractsMap } = collectNodeData(dataSchema);

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
  const templates = createAndRegisterTemplates(
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
