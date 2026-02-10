// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode, WizardStepMessages, WizardConstraint, WizardNLPContract } from '../types';
import type { DialogueTask } from '@services/DialogueTaskService';
import { TaskType, templateIdToTaskType } from '@types/taskTypes';
import { v4 as uuidv4 } from 'uuid';
import { cloneTemplateSteps } from '@utils/taskUtils';
import type { TaskTreeNode } from '@types/taskTypes';

/**
 * Generalizes a label by removing context-specific references
 *
 * Example:
 * - "Chiedi la data di nascita del paziente" → "Data di nascita"
 * - "Chiedi il nome del cliente" → "Nome"
 */
export function generalizeLabel(label: string): string {
  // Remove common prefixes
  let generalized = label
    .replace(/^(chiedi|chiedere|richiedi|richiedere)\s+(la|il|lo|gli|le|un|una|uno)\s+/i, '')
    .replace(/^(chiedi|chiedere|richiedi|richiedere)\s+/i, '')
    .trim();

  // Remove context-specific references (del paziente, del cliente, ecc.)
  generalized = generalized.replace(/\s+(del|della|dello|dei|degli|delle)\s+\w+$/i, '');

  return generalized || label;  // Fallback if generalization fails
}

/**
 * Helper per creare una escalation con un messaggio
 * Allineato con saveIntentMessages.ts per coerenza del modello dati
 *
 * LOG TRACING:
 * - Input: text (messaggio)
 * - Output: escalation con task nel formato corretto
 * - Validazione: templateIdToTaskType('sayMessage') deve restituire TaskType.SayMessage
 */
function createEscalationFromMessage(text: string): any {
  console.log('[TemplateCreationService][createEscalationFromMessage] 🎯 Entry', {
    textLength: text?.length,
    textPreview: text?.substring(0, 50),
  });

  const taskId = uuidv4();
  const templateId = 'sayMessage';

  console.log('[TemplateCreationService][createEscalationFromMessage] 🔍 Calling templateIdToTaskType', {
    templateId,
    templateIdType: typeof templateId,
  });

  // CRITICAL: NO FALLBACK - type MUST be derived from templateId
  const taskType = templateIdToTaskType(templateId);

  console.log('[TemplateCreationService][createEscalationFromMessage] ✅ templateIdToTaskType result', {
    templateId,
    taskType,
    taskTypeName: TaskType[taskType],
    isUndefined: taskType === TaskType.UNDEFINED,
    TaskTypeSayMessage: TaskType.SayMessage,
    TaskTypeUndefined: TaskType.UNDEFINED,
  });

  if (taskType === TaskType.UNDEFINED) {
    const errorMessage = `[TemplateCreationService] Cannot determine task type from templateId '${templateId}'. This is a bug in task creation.`;
    console.error('[TemplateCreationService][createEscalationFromMessage] ❌ ERROR', {
      templateId,
      taskType,
      errorMessage,
      availableCases: ['saymessage', 'utteranceinterpretation', 'classifyproblem', 'backendcall'],
    });
    throw new Error(errorMessage);
  }

  const escalation = {
    escalationId: uuidv4(),
    tasks: [
      {
        id: taskId,
        type: taskType,
        templateId: templateId,
        parameters: [
          {
            parameterId: 'text',
            value: text, // Direct text value
          },
        ],
      },
    ],
  };

  console.log('[TemplateCreationService][createEscalationFromMessage] ✅ Escalation created', {
    escalationId: escalation.escalationId,
    taskId: escalation.tasks[0].id,
    taskType: escalation.tasks[0].type,
    taskTemplateId: escalation.tasks[0].templateId,
    hasParameters: escalation.tasks[0].parameters?.length > 0,
    parameterValue: escalation.tasks[0].parameters?.[0]?.value?.substring(0, 50),
  });

  return escalation;
}

/**
 * Helper per creare uno step con escalations
 * Allineato con saveIntentMessages.ts per coerenza del modello dati
 *
 * LOG TRACING:
 * - Input: stepType, messages[]
 * - Output: step con escalations array
 */
function createStepWithEscalations(
  stepType: string,
  messages: string[]
): any {
  console.log('[TemplateCreationService][createStepWithEscalations] 🎯 Entry', {
    stepType,
    messagesCount: messages?.length,
    messagesPreview: messages?.slice(0, 3).map(m => m?.substring(0, 30)),
  });

  const escalations = messages.map((msg, idx) => {
    console.log('[TemplateCreationService][createStepWithEscalations] 🔄 Creating escalation', {
      stepType,
      messageIndex: idx,
      messageLength: msg?.length,
    });
    return createEscalationFromMessage(msg);
  });

  const step = {
    type: stepType,
    escalations,
  };

  console.log('[TemplateCreationService][createStepWithEscalations] ✅ Step created', {
    stepType,
    escalationsCount: escalations.length,
    firstEscalationId: escalations[0]?.escalationId,
    firstTaskId: escalations[0]?.tasks?.[0]?.id,
  });

  return step;
}

/**
 * Converts WizardStepMessages to steps dictionary format with escalations
 * Dictionary: { "templateId": { "start": { type: "start", escalations: [...] }, ... } }
 *
 * ALLINEATO con saveIntentMessages.ts per coerenza del modello dati
 *
 * LOG TRACING:
 * - Input: messages (WizardStepMessages), templateId
 * - Output: steps dictionary con formato corretto
 */
function convertMessagesToStepsDictionary(
  messages: WizardStepMessages,
  templateId: string
): Record<string, Record<string, any>> {
  console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 🎯 Entry', {
    templateId,
    hasAskBase: !!messages.ask?.base,
    askBaseCount: messages.ask?.base?.length,
    hasAskReask: !!messages.ask?.reask,
    askReaskCount: messages.ask?.reask?.length,
    hasNoInput: !!messages.noInput?.base,
    noInputCount: messages.noInput?.base?.length,
    hasConfirm: !!messages.confirm?.base,
    confirmCount: messages.confirm?.base?.length,
    hasNotConfirmed: !!messages.notConfirmed?.base,
    notConfirmedCount: messages.notConfirmed?.base?.length,
    hasViolation: !!messages.violation?.base,
    violationCount: messages.violation?.base?.length,
    hasSuccess: !!messages.success?.base,
    successCount: messages.success?.base?.length,
  });

  const stepRecord: Record<string, any> = {};

  // Ask messages -> start step
  if (messages.ask?.base && messages.ask.base.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating start step', {
      templateId,
      messagesCount: messages.ask.base.length,
    });
    stepRecord.start = createStepWithEscalations('start', messages.ask.base);
  }

  // Reask messages -> noMatch step
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating noMatch step', {
      templateId,
      messagesCount: messages.ask.reask.length,
    });
    stepRecord.noMatch = createStepWithEscalations('noMatch', messages.ask.reask);
  }

  // ✅ FIX: noInput messages -> noInput step (Non ho sentito)
  if (messages.noInput?.base && messages.noInput.base.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating noInput step', {
      templateId,
      messagesCount: messages.noInput.base.length,
    });
    stepRecord.noInput = createStepWithEscalations('noInput', messages.noInput.base);
  }

  // Confirm messages -> confirmation step
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating confirmation step', {
      templateId,
      messagesCount: messages.confirm.base.length,
    });
    stepRecord.confirmation = createStepWithEscalations('confirmation', messages.confirm.base);
  }

  // Not confirmed -> notConfirmed step
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating notConfirmed step', {
      templateId,
      messagesCount: messages.notConfirmed.base.length,
    });
    stepRecord.notConfirmed = createStepWithEscalations('notConfirmed', messages.notConfirmed.base);
  }

  // Violation messages -> violation step
  if (messages.violation?.base && messages.violation.base.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating violation step', {
      templateId,
      messagesCount: messages.violation.base.length,
    });
    stepRecord.violation = createStepWithEscalations('violation', messages.violation.base);
  }

  // Success messages -> success step
  if (messages.success?.base && messages.success.base.length > 0) {
    console.log('[TemplateCreationService][convertMessagesToStepsDictionary] 📝 Creating success step', {
      templateId,
      messagesCount: messages.success.base.length,
    });
    stepRecord.success = createStepWithEscalations('success', messages.success.base);
  }

  const result = { [templateId]: stepRecord };

  console.log('[TemplateCreationService][convertMessagesToStepsDictionary] ✅ Steps dictionary created', {
    templateId,
    stepTypes: Object.keys(stepRecord),
    stepTypesCount: Object.keys(stepRecord).length,
    resultKeys: Object.keys(result),
    resultStructure: {
      templateId,
      stepsCount: Object.keys(stepRecord).length,
      firstStepType: Object.keys(stepRecord)[0],
      firstStepEscalationsCount: stepRecord[Object.keys(stepRecord)[0]]?.escalations?.length,
    },
  });

  return result;
}

/**
 * Creates a template for each node in the wizard-generated structure
 *
 * Each node gets its own template with:
 * - Generalized label
 * - Steps (generalized messages)
 * - Constraints and NLP contract (referenced in template)
 * - References to child templates (subTasksIds)
 *
 * @param fakeTree - Structure generated by wizard (WizardTaskTreeNode[])
 * @param messagesGeneralized - Generalized messages (one set for all nodes, or per-node)
 * @param constraintsMap - Map of nodeId -> constraints
 * @param nlpContractsMap - Map of nodeId -> NLP contract
 * @param shouldBeGeneral - Flag indicating if template is generalizable
 * @returns Map<nodeId, DialogueTask> - One template per node
 */
export function createTemplatesFromWizardData(
  fakeTree: WizardTaskTreeNode[],
  messagesGeneralized: Map<string, WizardStepMessages>,
  constraintsMap: Map<string, WizardConstraint[]>,
  nlpContractsMap: Map<string, WizardNLPContract>,
  shouldBeGeneral: boolean = false
): Map<string, DialogueTask> {
  console.log('[TemplateCreationService][createTemplatesFromWizardData] 🎯 Entry', {
    fakeTreeLength: fakeTree?.length,
    fakeTreeStructure: fakeTree?.map(n => ({
      id: n.id,
      templateId: n.templateId,
      label: n.label,
      hasSubNodes: !!n.subNodes,
      subNodesCount: n.subNodes?.length,
    })),
    messagesGeneralizedMapSize: messagesGeneralized?.size || 0,
    messagesGeneralizedKeys: messagesGeneralized ? Array.from(messagesGeneralized.keys()) : [],
    constraintsMapSize: constraintsMap?.size,
    nlpContractsMapSize: nlpContractsMap?.size,
    shouldBeGeneral,
  });

  const templates = new Map<string, DialogueTask>();

  /**
   * Recursive helper to create template for a node
   */
  const createTemplateForNode = (node: WizardTaskTreeNode): DialogueTask => {
    // ✅ INVARIANT CHECK: node.id MUST equal node.templateId (single source of truth)
    if (node.id !== node.templateId) {
      console.error('[TemplateCreationService][createTemplateForNode] ❌ CRITICAL: node.id !== node.templateId', {
        nodeId: node.id,
        nodeTemplateId: node.templateId,
        nodeLabel: node.label,
      });
      throw new Error(
        `[TemplateCreationService] CRITICAL: node.id (${node.id}) !== node.templateId (${node.templateId}) for node "${node.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ ALWAYS use node.id as the single source of truth (no fallback, no templateId)
    const templateId = node.id;

    console.log('[TemplateCreationService][createTemplateForNode] 🎯 Creating template for node', {
      nodeId: node.id,
      templateId,
      nodeLabel: node.label,
      hasSubNodes: !!node.subNodes,
      subNodesCount: node.subNodes?.length,
    });

    // Collect subTasksIds from children
    const subTasksIds: string[] = [];
    if (node.subNodes && node.subNodes.length > 0) {
      node.subNodes.forEach(subNode => {
        // ✅ INVARIANT CHECK: subNode.id MUST equal subNode.templateId
        if (subNode.id !== subNode.templateId) {
          console.error('[TemplateCreationService][createTemplateForNode] ❌ CRITICAL: subNode.id !== subNode.templateId', {
            subNodeId: subNode.id,
            subNodeTemplateId: subNode.templateId,
            subNodeLabel: subNode.label,
            parentNodeId: node.id,
            parentNodeLabel: node.label,
          });
          throw new Error(
            `[TemplateCreationService] CRITICAL: subNode.id (${subNode.id}) !== subNode.templateId (${subNode.templateId}) for subNode "${subNode.label}". ` +
            `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
          );
        }

        // ✅ ALWAYS use subNode.id (no fallback)
        const subTemplateId = subNode.id;
        subTasksIds.push(subTemplateId);

        // Create template for child (recursive)
        if (!templates.has(subTemplateId)) {
          const subTemplate = createTemplateForNode(subNode);
          templates.set(subTemplateId, subTemplate);
        }
      });
    }

    console.log('[TemplateCreationService][createTemplateForNode] 📝 Converting messages to steps', {
      templateId,
      hasMessagesGeneralized: !!messagesGeneralized,
    });

    // ✅ Get messages for this specific node from the map
    // ✅ LOGGING PLAN E: Log detailed info before lookup
    console.log('[TemplateCreationService][createTemplateForNode] 🔍 Looking up messages for node', {
      nodeId: node.id,
      templateId: node.templateId,
      nodeLabel: node.label,
      nodeType: node.type,
      hasSubNodes: !!node.subNodes,
      subNodesCount: node.subNodes?.length || 0,
      messagesMapSize: messagesGeneralized.size,
      availableMessageIds: Array.from(messagesGeneralized.keys()),
      idMatchesTemplateId: node.id === node.templateId,
    });

    const nodeMessages = messagesGeneralized.get(node.id);
    if (!nodeMessages) {
      // ✅ D2: RIMUOVERE fallback messaggi vuoti
      // ✅ Se arriviamo qui, è un bug upstream (checkAndComplete non ha funzionato)
      console.error('[TemplateCreationService][createTemplateForNode] ❌ CRITICAL: Node missing messages', {
        nodeId: node.id,
        nodeLabel: node.label,
        templateId: node.templateId,
        nodeType: node.type,
        availableMessageIds: Array.from(messagesGeneralized.keys()),
        expectedId: node.id,
        actualTemplateId: node.templateId,
        idMismatch: node.id !== node.templateId,
        messagesMapSize: messagesGeneralized.size,
        allAvailableIds: Array.from(messagesGeneralized.keys()),
        // ✅ LOGGING PLAN E: Detailed diagnostic info
        diagnostic: {
          nodeIdInMap: messagesGeneralized.has(node.id),
          templateIdInMap: messagesGeneralized.has(node.templateId),
          similarIds: Array.from(messagesGeneralized.keys()).filter(id =>
            id.includes(node.id.substring(0, 8)) || node.id.includes(id.substring(0, 8))
          ),
        },
      });

      throw new Error(
        `[TemplateCreationService] CRITICAL: Node "${node.label}" (id: ${node.id}) is missing messages. ` +
        `This should never happen - checkAndComplete should have prevented this. ` +
        `Available message IDs: ${Array.from(messagesGeneralized.keys()).join(', ')}.`
      );
    }

    // ✅ LOGGING PLAN E: Log successful message lookup
    console.log('[TemplateCreationService][createTemplateForNode] ✅ Messages found for node', {
      nodeId: node.id,
      nodeLabel: node.label,
      hasAsk: !!nodeMessages.ask,
      hasNoInput: !!nodeMessages.noInput,
      hasConfirm: !!nodeMessages.confirm,
      hasNotConfirmed: !!nodeMessages.notConfirmed,
      hasViolation: !!nodeMessages.violation,
      hasSuccess: !!nodeMessages.success,
      askCount: nodeMessages.ask?.base?.length || 0,
      noInputCount: nodeMessages.noInput?.base?.length || 0,
      confirmCount: nodeMessages.confirm?.base?.length || 0,
      notConfirmedCount: nodeMessages.notConfirmed?.base?.length || 0,
      violationCount: nodeMessages.violation?.base?.length || 0,
      successCount: nodeMessages.success?.base?.length || 0,
    });

    // ✅ D2: Se arriviamo qui, nodeMessages esiste (garantito da verifiche upstream)
    const messagesToUse = nodeMessages;

    // ✅ LOGGING PLAN E: Log before converting to steps
    console.log('[TemplateCreationService][createTemplateForNode] 📝 Converting messages to steps', {
      templateId,
      nodeId: node.id,
      nodeLabel: node.label,
      usingEmptyMessages: !nodeMessages,
      messagesStructure: {
        hasAsk: !!messagesToUse.ask,
        hasNoInput: !!messagesToUse.noInput,
        hasConfirm: !!messagesToUse.confirm,
        hasNotConfirmed: !!messagesToUse.notConfirmed,
        hasViolation: !!messagesToUse.violation,
        hasSuccess: !!messagesToUse.success,
      },
    });

    // Convert generalized messages to steps dictionary (per-node messages)
    const steps = convertMessagesToStepsDictionary(messagesToUse, templateId);

    console.log('[TemplateCreationService][createTemplateForNode] ✅ Steps converted', {
      templateId,
      stepsKeys: Object.keys(steps),
      stepsStructure: steps[templateId] ? Object.keys(steps[templateId]) : [],
      firstStepEscalations: steps[templateId]?.[Object.keys(steps[templateId] || {})[0]]?.escalations?.length,
    });

    // Get constraints and NLP contract for this node
    const constraints = constraintsMap.get(node.id) || [];
    const nlpContract = nlpContractsMap.get(node.id);

    // Create template
    const template: DialogueTask = {
      id: templateId,
      _id: templateId,  // For MongoDB compatibility
      templateId: null,  // Template has always templateId === null
      name: generalizeLabel(node.label).toLowerCase().replace(/\s+/g, '_'),  // Canonical name
      label: generalizeLabel(node.label),  // Generalized label
      type: TaskType.UtteranceInterpretation,  // Default to UtteranceInterpretation
      icon: node.icon || 'FileText',
      subTasksIds: subTasksIds.length > 0 ? subTasksIds : undefined,
      steps: steps,  // Dictionary: { "templateId": { "start": {...}, ... } }
      dataContracts: constraints.length > 0 ? constraints : undefined,
      constraints: constraints.length > 0 ? constraints : undefined,  // Alias
      nlpContract: nlpContract,
      shouldBeGeneral: shouldBeGeneral,  // Flag for UI decision
    };

    console.log('[TemplateCreationService][createTemplateForNode] ✅ Template created', {
      templateId,
      templateLabel: template.label,
      templateStepsKeys: template.steps ? Object.keys(template.steps) : [],
      templateStepsStructure: template.steps?.[templateId] ? Object.keys(template.steps[templateId]) : [],
      templateStepsFirstStep: template.steps?.[templateId]?.[Object.keys(template.steps[templateId] || {})[0]],
    });

    templates.set(templateId, template);
    return template;
  };

  // ✅ LOGGING PLAN E: Log before creating templates for root nodes
  console.log('[TemplateCreationService][createTemplatesFromWizardData] 📊 LOGGING PLAN E: Starting template creation for root nodes', {
    rootNodesCount: fakeTree.length,
    rootNodes: fakeTree.map(root => ({
      id: root.id,
      templateId: root.templateId,
      label: root.label,
      type: root.type,
      hasSubNodes: !!root.subNodes,
      subNodesCount: root.subNodes?.length || 0,
      idMatchesTemplateId: root.id === root.templateId,
    })),
    messagesMapSize: messagesGeneralized.size,
    availableMessageIds: Array.from(messagesGeneralized.keys()),
  });

  // Create template for each root node
  fakeTree.forEach(rootNode => {
    // ✅ INVARIANT CHECK: rootNode.id MUST equal rootNode.templateId
    if (rootNode.id !== rootNode.templateId) {
      console.error('[TemplateCreationService][createTemplatesFromWizardData] ❌ CRITICAL: rootNode.id !== rootNode.templateId', {
        rootNodeId: rootNode.id,
        rootNodeTemplateId: rootNode.templateId,
        rootNodeLabel: rootNode.label,
      });
      throw new Error(
        `[TemplateCreationService] CRITICAL: rootNode.id (${rootNode.id}) !== rootNode.templateId (${rootNode.templateId}) for rootNode "${rootNode.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ ALWAYS use rootNode.id (no fallback)
    const rootTemplateId = rootNode.id;

    // ✅ LOGGING PLAN E: Log before creating each root template
    console.log('[TemplateCreationService][createTemplatesFromWizardData] 🔄 LOGGING PLAN E: Creating template for root node', {
      rootNodeId: rootNode.id,
      rootTemplateId,
      rootNodeLabel: rootNode.label,
      templateAlreadyExists: templates.has(rootTemplateId),
      hasMessages: messagesGeneralized.has(rootNode.id),
    });

    if (!templates.has(rootTemplateId)) {
      createTemplateForNode(rootNode);
    } else {
      console.log('[TemplateCreationService][createTemplatesFromWizardData] ⏭️ LOGGING PLAN E: Skipping root node (template already exists)', {
        rootNodeId: rootNode.id,
        rootTemplateId,
        rootNodeLabel: rootNode.label,
      });
    }
  });

  console.log('[TemplateCreationService][createTemplatesFromWizardData] ✅ All templates created', {
    templatesCount: templates.size,
    templateIds: Array.from(templates.keys()),
    templatesStructure: Array.from(templates.entries()).map(([id, t]) => ({
      id,
      label: t.label,
      stepsKeys: t.steps ? Object.keys(t.steps) : [],
      stepsStructure: t.steps?.[id] ? Object.keys(t.steps[id]) : [],
    })),
  });

  return templates;
}

/**
 * Converts contextualized messages to steps with escalations
 * ALLINEATO con saveIntentMessages.ts per coerenza del modello dati
 *
 * LOG TRACING:
 * - Input: messages (WizardStepMessages), templateId
 * - Output: stepRecord con formato corretto (senza wrapper templateId)
 */
function convertContextualizedMessagesToSteps(
  messages: WizardStepMessages,
  templateId: string
): Record<string, any> {
  console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 🎯 Entry', {
    templateId,
    hasAskBase: !!messages.ask?.base,
    askBaseCount: messages.ask?.base?.length,
    hasAskReask: !!messages.ask?.reask,
    askReaskCount: messages.ask?.reask?.length,
    hasConfirm: !!messages.confirm?.base,
    confirmCount: messages.confirm?.base?.length,
    hasNotConfirmed: !!messages.notConfirmed?.base,
    notConfirmedCount: messages.notConfirmed?.base?.length,
    hasViolation: !!messages.violation?.base,
    violationCount: messages.violation?.base?.length,
    hasSuccess: !!messages.success?.base,
    successCount: messages.success?.base?.length,
  });

  const stepRecord: Record<string, any> = {};

  // Ask messages -> start step
  if (messages.ask?.base && messages.ask.base.length > 0) {
    console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 📝 Creating start step', {
      templateId,
      messagesCount: messages.ask.base.length,
    });
    stepRecord.start = createStepWithEscalations('start', messages.ask.base);
  }

  // Reask messages -> noMatch step
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 📝 Creating noMatch step', {
      templateId,
      messagesCount: messages.ask.reask.length,
    });
    stepRecord.noMatch = createStepWithEscalations('noMatch', messages.ask.reask);
  }

  // Confirm messages -> confirmation step
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 📝 Creating confirmation step', {
      templateId,
      messagesCount: messages.confirm.base.length,
    });
    stepRecord.confirmation = createStepWithEscalations('confirmation', messages.confirm.base);
  }

  // Not confirmed -> notConfirmed step
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 📝 Creating notConfirmed step', {
      templateId,
      messagesCount: messages.notConfirmed.base.length,
    });
    stepRecord.notConfirmed = createStepWithEscalations('notConfirmed', messages.notConfirmed.base);
  }

  // Violation messages -> violation step
  if (messages.violation?.base && messages.violation.base.length > 0) {
    console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 📝 Creating violation step', {
      templateId,
      messagesCount: messages.violation.base.length,
    });
    stepRecord.violation = createStepWithEscalations('violation', messages.violation.base);
  }

  // Success messages -> success step
  if (messages.success?.base && messages.success.base.length > 0) {
    console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] 📝 Creating success step', {
      templateId,
      messagesCount: messages.success.base.length,
    });
    stepRecord.success = createStepWithEscalations('success', messages.success.base);
  }

  console.log('[TemplateCreationService][convertContextualizedMessagesToSteps] ✅ StepRecord created', {
    templateId,
    stepTypes: Object.keys(stepRecord),
    stepTypesCount: Object.keys(stepRecord).length,
    firstStepType: Object.keys(stepRecord)[0],
    firstStepEscalationsCount: stepRecord[Object.keys(stepRecord)[0]]?.escalations?.length,
  });

  return stepRecord;
}

/**
 * Builds TaskTreeNode[] from templates (for cloneTemplateSteps)
 */
function buildNodesFromTemplates(
  rootTemplate: DialogueTask,
  allTemplates: Map<string, DialogueTask>
): TaskTreeNode[] {
  const buildNode = (template: DialogueTask): TaskTreeNode => {
    const node: TaskTreeNode = {
      id: template.id || '',
      templateId: template.id || '',
      label: template.label || '',
      type: template.type,
      icon: template.icon,
    };

    // Build subNodes from subTasksIds
    if (template.subTasksIds && template.subTasksIds.length > 0) {
      node.subNodes = template.subTasksIds
        .map(subTemplateId => {
          const subTemplate = allTemplates.get(subTemplateId);
          return subTemplate ? buildNode(subTemplate) : null;
        })
        .filter((n): n is TaskTreeNode => n !== null);
    }

    return node;
  };

  return [buildNode(rootTemplate)];
}

/**
 * Creates a contextualized instance from templates
 *
 * - Clones steps from template root (generalized)
 * - Applies contextualized messages only to root node
 * - Creates instance with templateId referencing root template
 *
 * @param rootTemplate - Root template (generalized)
 * @param allTemplates - All templates (including children)
 * @param contextualizedMessages - Contextualized messages (for root node only)
 * @param taskLabel - Contextualized task label
 * @param taskId - Task instance ID
 * @returns Task instance
 */
export function createContextualizedInstance(
  rootTemplate: DialogueTask,
  allTemplates: Map<string, DialogueTask>,
  contextualizedMessages: WizardStepMessages,
  taskLabel: string,
  taskId: string
): any {
  // 1. Build nodes from templates (for cloneTemplateSteps)
  const nodes = buildNodesFromTemplates(rootTemplate, allTemplates);

  // 2. Clone steps from template using cloneTemplateSteps (correct way)
  const { steps: clonedSteps } = cloneTemplateSteps(rootTemplate, nodes);

  // 3. Apply contextualized messages only to root node
  const rootTemplateId = rootTemplate.id || '';
  const contextualizedRootSteps = convertContextualizedMessagesToSteps(contextualizedMessages, rootTemplateId);
  if (clonedSteps[rootTemplateId]) {
    clonedSteps[rootTemplateId] = contextualizedRootSteps;
  } else {
    clonedSteps[rootTemplateId] = contextualizedRootSteps;
  }

  // 4. Create instance
  const instance: any = {
    id: taskId,
    type: rootTemplate.type || 3,  // TaskType.UtteranceInterpretation
    templateId: rootTemplate.id,  // Reference to root template
    label: taskLabel,  // Contextualized label
    steps: clonedSteps,  // Cloned steps with contextualized root
  };

  return instance;
}
