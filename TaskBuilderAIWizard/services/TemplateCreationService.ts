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
 * ✅ FASE 1.2: Genera GUID e salva traduzioni invece di usare testo letterale
 *
 * LOG TRACING:
 * - Input: text (messaggio), addTranslation callback
 * - Output: escalation con task nel formato corretto
 * - Validazione: templateIdToTaskType('sayMessage') deve restituire TaskType.SayMessage
 */
function createEscalationFromMessage(
  text: string,
  addTranslation?: (guid: string, text: string) => void
): any {
  // ✅ STEP 1: Genera GUID per la chiave di traduzione
  const textKey = uuidv4();
  const taskId = uuidv4();
  const templateId = 'sayMessage';

  // ✅ STEP 2: Salva traduzione
  const addTranslationFn = addTranslation || (() => {
    // Fallback: use window context if available
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const ctx = (window as any).__projectTranslationsContext;
      if (ctx.addTranslation) {
        return ctx.addTranslation;
      } else if (ctx.addTranslations) {
        return (guid: string, text: string) => ctx.addTranslations({ [guid]: text });
      }
    }
    return (guid: string, text: string) => {
      console.warn('[TemplateCreationService] ⚠️ No translation context available, translation not saved:', { guid, text: text.substring(0, 50) });
    };
  })();

  if (addTranslationFn && typeof addTranslationFn === 'function') {
    addTranslationFn(textKey, text);
  }

  // ✅ STEP 3: Determina taskType
  const taskType = templateIdToTaskType(templateId);

  if (taskType === TaskType.UNDEFINED) {
    const errorMessage = `[TemplateCreationService] Cannot determine task type from templateId '${templateId}'. This is a bug in task creation.`;
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
            value: textKey, // ✅ GUID invece di testo letterale
          },
        ],
      },
    ],
  };

  return escalation;
}

/**
 * Helper per creare uno step con escalations
 * Allineato con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Passa addTranslation attraverso la catena
 *
 * LOG TRACING:
 * - Input: stepType, messages[], addTranslation callback
 * - Output: step con escalations array
 */
function createStepWithEscalations(
  stepType: string,
  messages: string[],
  addTranslation?: (guid: string, text: string) => void
): any {
  const escalations = messages.map((msg) => {
    return createEscalationFromMessage(msg, addTranslation);
  });

  const step = {
    type: stepType,
    escalations,
  };

  return step;
}

/**
 * Converts WizardStepMessages to steps dictionary format with escalations
 * Dictionary: { "templateId": { "start": { type: "start", escalations: [...] }, ... } }
 *
 * ALLINEATO con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Passa addTranslation attraverso la catena
 *
 * LOG TRACING:
 * - Input: messages (WizardStepMessages), templateId, addTranslation callback
 * - Output: steps dictionary con formato corretto
 */
function convertMessagesToStepsDictionary(
  messages: WizardStepMessages,
  templateId: string,
  addTranslation?: (guid: string, text: string) => void
): Record<string, Record<string, any>> {
  const stepRecord: Record<string, any> = {};

  // Ask messages -> start step
  if (messages.ask?.base && messages.ask.base.length > 0) {
    stepRecord.start = createStepWithEscalations('start', messages.ask.base, addTranslation);
  }

  // Reask messages -> noMatch step
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    stepRecord.noMatch = createStepWithEscalations('noMatch', messages.ask.reask, addTranslation);
  }

  // ✅ FIX: noInput messages -> noInput step (Non ho sentito)
  if (messages.noInput?.base && messages.noInput.base.length > 0) {
    stepRecord.noInput = createStepWithEscalations('noInput', messages.noInput.base, addTranslation);
  }

  // Confirm messages -> confirmation step
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    stepRecord.confirmation = createStepWithEscalations('confirmation', messages.confirm.base, addTranslation);
  }

  // Not confirmed -> notConfirmed step
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    stepRecord.notConfirmed = createStepWithEscalations('notConfirmed', messages.notConfirmed.base, addTranslation);
  }

  // Violation messages -> violation step
  if (messages.violation?.base && messages.violation.base.length > 0) {
    stepRecord.violation = createStepWithEscalations('violation', messages.violation.base, addTranslation);
  }

  // Success messages -> success step
  if (messages.success?.base && messages.success.base.length > 0) {
    stepRecord.success = createStepWithEscalations('success', messages.success.base, addTranslation);
  }

  const result = { [templateId]: stepRecord };

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
  shouldBeGeneral: boolean = false,
  addTranslation?: (guid: string, text: string) => void
): Map<string, DialogueTask> {
  const templates = new Map<string, DialogueTask>();

  /**
   * Recursive helper to create template for a node
   */
  const createTemplateForNode = (node: WizardTaskTreeNode): DialogueTask => {
    // ✅ INVARIANT CHECK: node.id MUST equal node.templateId (single source of truth)
    if (node.id !== node.templateId) {
      throw new Error(
        `[TemplateCreationService] CRITICAL: node.id (${node.id}) !== node.templateId (${node.templateId}) for node "${node.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ ALWAYS use node.id as the single source of truth (no fallback, no templateId)
    const templateId = node.id;

    // Collect subTasksIds from children
    const subTasksIds: string[] = [];
    if (node.subNodes && node.subNodes.length > 0) {
      node.subNodes.forEach(subNode => {
        // ✅ INVARIANT CHECK: subNode.id MUST equal subNode.templateId
        if (subNode.id !== subNode.templateId) {
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

    // ✅ Get messages for this specific node from the map
    const nodeMessages = messagesGeneralized.get(node.id);
    if (!nodeMessages) {
      throw new Error(
        `[TemplateCreationService] CRITICAL: Node "${node.label}" (id: ${node.id}) is missing messages. ` +
        `This should never happen - checkAndComplete should have prevented this. ` +
        `Available message IDs: ${Array.from(messagesGeneralized.keys()).join(', ')}.`
      );
    }

    // ✅ D2: Se arriviamo qui, nodeMessages esiste (garantito da verifiche upstream)
    const messagesToUse = nodeMessages;

    // Convert generalized messages to steps dictionary (per-node messages)
    const steps = convertMessagesToStepsDictionary(messagesToUse, templateId, addTranslation);

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

    templates.set(templateId, template);
    return template;
  };

  // Create template for each root node
  fakeTree.forEach(rootNode => {
    // ✅ INVARIANT CHECK: rootNode.id MUST equal rootNode.templateId
    if (rootNode.id !== rootNode.templateId) {
      throw new Error(
        `[TemplateCreationService] CRITICAL: rootNode.id (${rootNode.id}) !== rootNode.templateId (${rootNode.templateId}) for rootNode "${rootNode.label}". ` +
        `This should never happen. The ID must be consistent throughout the wizard lifecycle.`
      );
    }

    // ✅ ALWAYS use rootNode.id (no fallback)
    const rootTemplateId = rootNode.id;

    if (!templates.has(rootTemplateId)) {
      createTemplateForNode(rootNode);
    }
  });

  return templates;
}

/**
 * Converts contextualized messages to steps with escalations
 * ALLINEATO con saveIntentMessages.ts per coerenza del modello dati
 * ✅ FASE 1.2: Passa addTranslation attraverso la catena
 *
 * LOG TRACING:
 * - Input: messages (WizardStepMessages), templateId, addTranslation callback
 * - Output: stepRecord con formato corretto (senza wrapper templateId)
 */
function convertContextualizedMessagesToSteps(
  messages: WizardStepMessages,
  templateId: string,
  addTranslation?: (guid: string, text: string) => void
): Record<string, any> {
  const stepRecord: Record<string, any> = {};

  // Ask messages -> start step
  if (messages.ask?.base && messages.ask.base.length > 0) {
    stepRecord.start = createStepWithEscalations('start', messages.ask.base, addTranslation);
  }

  // Reask messages -> noMatch step
  if (messages.ask?.reask && messages.ask.reask.length > 0) {
    stepRecord.noMatch = createStepWithEscalations('noMatch', messages.ask.reask, addTranslation);
  }

  // Confirm messages -> confirmation step
  if (messages.confirm?.base && messages.confirm.base.length > 0) {
    stepRecord.confirmation = createStepWithEscalations('confirmation', messages.confirm.base, addTranslation);
  }

  // Not confirmed -> notConfirmed step
  if (messages.notConfirmed?.base && messages.notConfirmed.base.length > 0) {
    stepRecord.notConfirmed = createStepWithEscalations('notConfirmed', messages.notConfirmed.base, addTranslation);
  }

  // Violation messages -> violation step
  if (messages.violation?.base && messages.violation.base.length > 0) {
    stepRecord.violation = createStepWithEscalations('violation', messages.violation.base, addTranslation);
  }

  // Success messages -> success step
  if (messages.success?.base && messages.success.base.length > 0) {
    stepRecord.success = createStepWithEscalations('success', messages.success.base, addTranslation);
  }

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
  rowId: string, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  addTranslation?: (guid: string, text: string) => void
): any {
  // 1. Build nodes from templates (for cloneTemplateSteps)
  const nodes = buildNodesFromTemplates(rootTemplate, allTemplates);

  // 2. Clone steps from template using cloneTemplateSteps (correct way)
  const { steps: clonedSteps } = cloneTemplateSteps(rootTemplate, nodes);

  // 3. Apply contextualized messages only to root node
  const rootTemplateId = rootTemplate.id || '';
  const contextualizedRootSteps = convertContextualizedMessagesToSteps(contextualizedMessages, rootTemplateId, addTranslation);
  if (clonedSteps[rootTemplateId]) {
    clonedSteps[rootTemplateId] = contextualizedRootSteps;
  } else {
    clonedSteps[rootTemplateId] = contextualizedRootSteps;
  }

  // 4. Create instance
  const instance: any = {
    id: rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    type: rootTemplate.type || 3,  // TaskType.UtteranceInterpretation
    templateId: rootTemplate.id,  // Reference to root template
    label: taskLabel,  // Contextualized label
    steps: clonedSteps,  // Cloned steps with contextualized root
  };

  return instance;
}
